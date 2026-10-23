from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, contains_eager, joinedload

from app.database import get_db
from app.deps import get_optional_user, require_roles
from app.enums import Action, BookingStatus, EntityType, Role, WorkshopStatus
from app.models import Booking, Category, Review, User, Workshop
from app.schemas import (
    BookingCreate,
    BookingOut,
    Page,
    ParticipantOut,
    ParticipantsOut,
    ReviewOut,
    WorkshopIn,
    WorkshopOut,
    WorkshopUpdate,
)
from app.services.audit import log_action
from app.services.workshops import (
    ACTIVE_BOOKING_STATUSES,
    as_utc,
    confirmed_count,
    confirmed_count_expr,
    finish_past_workshops,
    lock_workshop,
    promote_from_waitlist,
    utcnow,
    workshop_out,
)

router = APIRouter(prefix="/workshops", tags=["workshops"])

# Статусы, которые видны всем (остальные — только мастеру-владельцу и админу)
PUBLIC_STATUSES = (WorkshopStatus.published, WorkshopStatus.finished, WorkshopStatus.cancelled)


def load_workshop_out(db: Session, workshop_id: int) -> WorkshopOut:
    row = db.execute(
        select(Workshop, confirmed_count_expr())
        .where(Workshop.id == workshop_id)
        .options(joinedload(Workshop.master), joinedload(Workshop.category))
        .execution_options(populate_existing=True)
    ).first()
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Мастер-класс не найден")
    return workshop_out(row[0], row[1])


def _ensure_category(db: Session, category_id: int) -> None:
    if db.get(Category, category_id) is None:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Категория не найдена")


def _ensure_future(start_at: datetime) -> None:
    if start_at <= utcnow():
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Время начала должно быть в будущем")


def _own_workshop(workshop: Workshop, user: User) -> None:
    if workshop.master_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Это не ваш мастер-класс")


# ---------------------------------------------------------------- каталог

@router.get("", response_model=Page[WorkshopOut])
def list_catalog(
    category_id: Optional[int] = None,
    master_id: Optional[int] = None,
    q: Optional[str] = Query(None, description="Поиск по названию и описанию"),
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    price_min: Optional[Decimal] = Query(None, ge=0),
    price_max: Optional[Decimal] = Query(None, ge=0),
    only_available: bool = Query(False, description="Только со свободными местами"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Публичный каталог: только опубликованные, ещё не начавшиеся мастер-классы активных мастеров."""
    finish_past_workshops(db)

    filters = [
        Workshop.status == WorkshopStatus.published,
        User.is_active.is_(True),
        Workshop.start_at > utcnow(),
    ]
    if category_id is not None:
        filters.append(Workshop.category_id == category_id)
    if master_id is not None:
        filters.append(Workshop.master_id == master_id)
    if q:
        filters.append(
            Workshop.title.icontains(q, autoescape=True) | Workshop.description.icontains(q, autoescape=True)
        )
    if date_from is not None:
        filters.append(Workshop.start_at >= datetime.combine(date_from, time.min, tzinfo=timezone.utc))
    if date_to is not None:
        filters.append(
            Workshop.start_at < datetime.combine(date_to + timedelta(days=1), time.min, tzinfo=timezone.utc)
        )
    if price_min is not None:
        filters.append(Workshop.price >= price_min)
    if price_max is not None:
        filters.append(Workshop.price <= price_max)
    if only_available:
        filters.append(confirmed_count_expr() < Workshop.capacity)

    total = db.scalar(
        select(func.count(Workshop.id)).join(User, Workshop.master_id == User.id).where(*filters)
    )
    rows = db.execute(
        select(Workshop, confirmed_count_expr())
        .join(User, Workshop.master_id == User.id)
        .where(*filters)
        .options(contains_eager(Workshop.master), joinedload(Workshop.category))
        .order_by(Workshop.start_at, Workshop.id)
        .offset(offset)
        .limit(limit)
    ).all()
    return Page[WorkshopOut](
        items=[workshop_out(w, c) for w, c in rows], total=total or 0, limit=limit, offset=offset
    )


@router.get("/mine", response_model=Page[WorkshopOut])
def list_my_workshops(
    status_filter: Optional[WorkshopStatus] = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    master: User = Depends(require_roles(Role.master)),
    db: Session = Depends(get_db),
):
    """Все мастер-классы текущего мастера, в любых статусах."""
    finish_past_workshops(db)
    filters = [Workshop.master_id == master.id]
    if status_filter is not None:
        filters.append(Workshop.status == status_filter)
    total = db.scalar(select(func.count(Workshop.id)).where(*filters))
    rows = db.execute(
        select(Workshop, confirmed_count_expr())
        .where(*filters)
        .options(joinedload(Workshop.master), joinedload(Workshop.category))
        .order_by(Workshop.created_at.desc(), Workshop.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return Page[WorkshopOut](
        items=[workshop_out(w, c) for w, c in rows], total=total or 0, limit=limit, offset=offset
    )


@router.get("/{workshop_id}", response_model=WorkshopOut)
def get_workshop(
    workshop_id: int,
    user: Optional[User] = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    finish_past_workshops(db)
    out = load_workshop_out(db, workshop_id)
    is_owner_or_admin = user is not None and (user.role == Role.admin or user.id == out.master.id)
    if not is_owner_or_admin and out.status not in PUBLIC_STATUSES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Мастер-класс не найден")
    return out


# ---------------------------------------------------------------- мастер

@router.post("", response_model=WorkshopOut, status_code=status.HTTP_201_CREATED)
def create_workshop(
    data: WorkshopIn,
    master: User = Depends(require_roles(Role.master)),
    db: Session = Depends(get_db),
):
    """Создаёт черновик. Неподтверждённый мастер тоже может вести черновики,
    но отправить на модерацию — только после подтверждения администратором."""
    _ensure_category(db, data.category_id)
    start_at = as_utc(data.start_at)
    _ensure_future(start_at)

    workshop = Workshop(
        master_id=master.id,
        category_id=data.category_id,
        title=data.title.strip(),
        description=data.description,
        location=data.location.strip(),
        start_at=start_at,
        duration_min=data.duration_min,
        price=data.price,
        capacity=data.capacity,
        status=WorkshopStatus.draft,
    )
    db.add(workshop)
    db.flush()
    log_action(db, master.id, EntityType.workshop, workshop.id, Action.created, f"Черновик «{workshop.title}»")
    db.commit()
    return load_workshop_out(db, workshop.id)


@router.patch("/{workshop_id}", response_model=WorkshopOut)
def update_workshop(
    workshop_id: int,
    data: WorkshopUpdate,
    master: User = Depends(require_roles(Role.master)),
    db: Session = Depends(get_db),
):
    workshop = lock_workshop(db, workshop_id)
    _own_workshop(workshop, master)
    if workshop.status not in (WorkshopStatus.draft, WorkshopStatus.rejected, WorkshopStatus.published):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Редактировать можно только черновик, отклонённый или опубликованный мастер-класс",
        )

    changes = data.model_dump(exclude_none=True)
    if not changes:
        return load_workshop_out(db, workshop.id)
    if "start_at" in changes:
        changes["start_at"] = as_utc(changes["start_at"])
        _ensure_future(changes["start_at"])
    if "category_id" in changes:
        _ensure_category(db, changes["category_id"])
    for field in ("title", "location"):
        if field in changes:
            changes[field] = changes[field].strip()

    old_capacity = workshop.capacity
    if workshop.status == WorkshopStatus.published:
        if workshop.start_at <= utcnow():
            raise HTTPException(status.HTTP_409_CONFLICT, "Мастер-класс уже начался")
        active = db.scalar(
            select(func.count(Booking.id)).where(
                Booking.workshop_id == workshop.id, Booking.status.in_(ACTIVE_BOOKING_STATUSES)
            )
        ) or 0
        if active > 0:
            # Есть активные брони — дату, место и цену менять нельзя
            for field in ("start_at", "location", "price"):
                if field in changes and changes[field] != getattr(workshop, field):
                    raise HTTPException(
                        status.HTTP_409_CONFLICT,
                        "Есть активные брони: нельзя менять дату и время, место и цену. "
                        "Отмените мастер-класс и создайте новый.",
                    )
        if "capacity" in changes and changes["capacity"] < confirmed_count(db, workshop.id):
            raise HTTPException(
                status.HTTP_409_CONFLICT, "Число мест нельзя уменьшить ниже количества подтверждённых броней"
            )

    for field, value in changes.items():
        setattr(workshop, field, value)
    db.flush()

    if workshop.status == WorkshopStatus.published and workshop.capacity > old_capacity:
        promote_from_waitlist(db, workshop, master.id)

    log_action(db, master.id, EntityType.workshop, workshop.id, Action.updated,
               "Изменены поля: " + ", ".join(sorted(changes)))
    db.commit()
    return load_workshop_out(db, workshop.id)


@router.post("/{workshop_id}/submit", response_model=WorkshopOut)
def submit_for_moderation(
    workshop_id: int,
    master: User = Depends(require_roles(Role.master)),
    db: Session = Depends(get_db),
):
    """draft/rejected → pending. Только для подтверждённого мастера."""
    workshop = lock_workshop(db, workshop_id)
    _own_workshop(workshop, master)
    if not master.is_approved:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Администратор ещё не подтвердил вашу учётную запись мастера")
    if workshop.status not in (WorkshopStatus.draft, WorkshopStatus.rejected):
        raise HTTPException(status.HTTP_409_CONFLICT, "На модерацию можно отправить только черновик или отклонённый мастер-класс")
    if workshop.start_at <= utcnow():
        raise HTTPException(status.HTTP_409_CONFLICT, "Время начала уже прошло — измените дату")

    workshop.status = WorkshopStatus.pending
    workshop.reject_reason = None
    log_action(db, master.id, EntityType.workshop, workshop.id, Action.updated, "Отправлен на модерацию")
    db.commit()
    return load_workshop_out(db, workshop.id)


@router.post("/{workshop_id}/cancel", response_model=WorkshopOut)
def cancel_workshop(
    workshop_id: int,
    user: User = Depends(require_roles(Role.master, Role.admin)),
    db: Session = Depends(get_db),
):
    """published → cancelled; все активные брони (confirmed и waitlisted) → cancelled."""
    workshop = lock_workshop(db, workshop_id)
    if user.role == Role.master:
        _own_workshop(workshop, user)
    if workshop.status != WorkshopStatus.published:
        raise HTTPException(status.HTTP_409_CONFLICT, "Отменить можно только опубликованный мастер-класс")
    now = utcnow()
    if workshop.start_at <= now:
        raise HTTPException(status.HTTP_409_CONFLICT, "Мастер-класс уже начался или прошёл")

    workshop.status = WorkshopStatus.cancelled
    result = db.execute(
        update(Booking)
        .where(Booking.workshop_id == workshop.id, Booking.status.in_(ACTIVE_BOOKING_STATUSES))
        .values(status=BookingStatus.cancelled, cancelled_at=now)
        .execution_options(synchronize_session=False)
    )
    log_action(db, user.id, EntityType.workshop, workshop.id, Action.cancelled,
               f"Мастер-класс отменён ({user.role.value}); аннулировано броней: {result.rowcount}")
    db.commit()
    return load_workshop_out(db, workshop.id)


@router.get("/{workshop_id}/participants", response_model=ParticipantsOut)
def get_participants(
    workshop_id: int,
    user: User = Depends(require_roles(Role.master, Role.admin)),
    db: Session = Depends(get_db),
):
    """Участники и лист ожидания: мастеру — только своих мастер-классов, админу — любых."""
    workshop = db.get(Workshop, workshop_id)
    if workshop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Мастер-класс не найден")
    if user.role == Role.master:
        _own_workshop(workshop, user)

    bookings = db.scalars(
        select(Booking)
        .where(Booking.workshop_id == workshop.id, Booking.status.in_(ACTIVE_BOOKING_STATUSES))
        .options(joinedload(Booking.client))
        .order_by(Booking.created_at, Booking.id)
    ).all()
    to_out = lambda b: ParticipantOut(booking_id=b.id, status=b.status, created_at=b.created_at, client=b.client)  # noqa: E731
    confirmed = [to_out(b) for b in bookings if b.status == BookingStatus.confirmed]
    waitlist = [to_out(b) for b in bookings if b.status == BookingStatus.waitlisted]
    return ParticipantsOut(
        capacity=workshop.capacity,
        free_seats=max(workshop.capacity - len(confirmed), 0),
        confirmed=confirmed,
        waitlist=waitlist,
    )


# ---------------------------------------------------------------- отзывы мастер-класса

@router.get("/{workshop_id}/reviews", response_model=Page[ReviewOut])
def get_workshop_reviews(
    workshop_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    workshop = db.get(Workshop, workshop_id)
    if workshop is None or workshop.status not in PUBLIC_STATUSES:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Мастер-класс не найден")
    filters = [Review.workshop_id == workshop_id, Review.is_hidden.is_(False)]
    total = db.scalar(select(func.count(Review.id)).where(*filters))
    items = db.scalars(
        select(Review)
        .where(*filters)
        .options(joinedload(Review.client))
        .order_by(Review.created_at.desc(), Review.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return Page[ReviewOut](items=items, total=total or 0, limit=limit, offset=offset)


# ---------------------------------------------------------------- бронирование

@router.post("/{workshop_id}/bookings", response_model=BookingOut, status_code=status.HTTP_201_CREATED)
def book_workshop(
    workshop_id: int,
    data: Optional[BookingCreate] = None,
    client: User = Depends(require_roles(Role.client)),
    db: Session = Depends(get_db),
):
    """Бронь места. Проверка и создание — в одной транзакции с блокировкой строки мастер-класса
    (SELECT ... FOR UPDATE), поэтому последнее место не достанется двоим сразу.
    Если мест нет, нужно передать join_waitlist=true — тогда бронь получит статус waitlisted."""
    data = data or BookingCreate()
    finish_past_workshops(db)

    workshop = lock_workshop(db, workshop_id)
    if workshop.status != WorkshopStatus.published:
        raise HTTPException(status.HTTP_409_CONFLICT, "Мастер-класс недоступен для бронирования")
    if workshop.start_at <= utcnow():
        raise HTTPException(status.HTTP_409_CONFLICT, "Мастер-класс уже начался")
    master = db.get(User, workshop.master_id)
    if master is None or not master.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "Мастер-класс недоступен для бронирования")

    already = db.scalar(
        select(Booking.id).where(
            Booking.workshop_id == workshop.id,
            Booking.client_id == client.id,
            Booking.status.in_(ACTIVE_BOOKING_STATUSES),
        )
    )
    if already:
        raise HTTPException(status.HTTP_409_CONFLICT, "Вы уже записаны на этот мастер-класс")

    if confirmed_count(db, workshop.id) < workshop.capacity:
        booking_status = BookingStatus.confirmed
    elif data.join_waitlist:
        booking_status = BookingStatus.waitlisted
    else:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            detail={
                "code": "no_free_seats",
                "message": "Свободных мест нет. Можно встать в лист ожидания (join_waitlist=true).",
            },
        )

    booking = Booking(workshop_id=workshop.id, client_id=client.id, status=booking_status)
    db.add(booking)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Вы уже записаны на этот мастер-класс")
    log_action(db, client.id, EntityType.booking, booking.id, Action.created,
               f"Мастер-класс #{workshop.id}, статус: {booking_status.value}")
    db.commit()

    from app.routers.bookings import load_booking  # локальный импорт: избегаем циклической зависимости

    return load_booking(db, booking.id)
