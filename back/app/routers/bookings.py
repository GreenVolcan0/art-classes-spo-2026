from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.config import settings
from app.database import get_db
from app.deps import require_roles
from app.enums import Action, BookingStatus, EntityType, Role, WorkshopStatus
from app.models import Booking, Review, User, Workshop
from app.schemas import BookingOut, Page, ReviewIn, ReviewOut
from app.services.audit import log_action
from app.services.workshops import finish_past_workshops, lock_workshop, promote_from_waitlist, utcnow

router = APIRouter(prefix="/bookings", tags=["bookings"])


def load_booking(db: Session, booking_id: int) -> Booking:
    booking = db.scalar(
        select(Booking)
        .where(Booking.id == booking_id)
        .options(
            joinedload(Booking.workshop).joinedload(Workshop.master),
            joinedload(Booking.review),
        )
        .execution_options(populate_existing=True)
    )
    if booking is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Бронь не найдена")
    return booking


def _own_booking(db: Session, booking_id: int, client: User) -> Booking:
    booking = db.get(Booking, booking_id)
    # Чужие брони не раскрываем: для клиента их как будто нет
    if booking is None or booking.client_id != client.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Бронь не найдена")
    return booking


@router.get("/my", response_model=Page[BookingOut])
def my_bookings(
    status_filter: Optional[BookingStatus] = Query(None, alias="status"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    client: User = Depends(require_roles(Role.client)),
    db: Session = Depends(get_db),
):
    """Мои записи и их статусы."""
    finish_past_workshops(db)
    filters = [Booking.client_id == client.id]
    if status_filter is not None:
        filters.append(Booking.status == status_filter)
    total = db.scalar(select(func.count(Booking.id)).where(*filters))
    items = db.scalars(
        select(Booking)
        .where(*filters)
        .options(joinedload(Booking.workshop).joinedload(Workshop.master), joinedload(Booking.review))
        .order_by(Booking.created_at.desc(), Booking.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return Page[BookingOut](items=items, total=total or 0, limit=limit, offset=offset)


@router.post("/{booking_id}/cancel", response_model=BookingOut)
def cancel_booking(
    booking_id: int,
    client: User = Depends(require_roles(Role.client)),
    db: Session = Depends(get_db),
):
    """confirmed — не позднее чем за CANCEL_DEADLINE_HOURS до начала; waitlisted — в любой момент до начала.
    При отмене подтверждённой брони первый из листа ожидания получает место в той же транзакции."""
    booking = _own_booking(db, booking_id, client)
    workshop = lock_workshop(db, booking.workshop_id)
    db.refresh(booking)  # статус мог измениться, пока ждали блокировку (например, перевод из очереди)

    if booking.status == BookingStatus.cancelled:
        raise HTTPException(status.HTTP_409_CONFLICT, "Бронь уже отменена")
    now = utcnow()
    if workshop.start_at <= now:
        raise HTTPException(status.HTTP_409_CONFLICT, "Мастер-класс уже начался, отмена невозможна")
    deadline = timedelta(hours=settings.cancel_deadline_hours)
    if booking.status == BookingStatus.confirmed and workshop.start_at - now < deadline:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Подтверждённую бронь можно отменить не позднее чем за {settings.cancel_deadline_hours} ч до начала",
        )

    was_confirmed = booking.status == BookingStatus.confirmed
    previous = booking.status.value
    booking.status = BookingStatus.cancelled
    booking.cancelled_at = now
    log_action(db, client.id, EntityType.booking, booking.id, Action.cancelled,
               f"Отмена клиентом (было: {previous}), мастер-класс #{workshop.id}")
    db.flush()
    if was_confirmed:
        promote_from_waitlist(db, workshop, client.id)
    db.commit()
    return load_booking(db, booking.id)


@router.post("/{booking_id}/review", response_model=ReviewOut, status_code=status.HTTP_201_CREATED)
def create_review(
    booking_id: int,
    data: ReviewIn,
    client: User = Depends(require_roles(Role.client)),
    db: Session = Depends(get_db),
):
    """Отзыв: только по подтверждённой брони на проведённый (finished) мастер-класс, один на бронь."""
    finish_past_workshops(db)
    booking = _own_booking(db, booking_id, client)
    if booking.status != BookingStatus.confirmed:
        raise HTTPException(status.HTTP_409_CONFLICT, "Отзыв можно оставить только при подтверждённой брони")
    workshop = db.get(Workshop, booking.workshop_id)
    if workshop is None or workshop.status != WorkshopStatus.finished:
        raise HTTPException(status.HTTP_409_CONFLICT, "Отзыв можно оставить только после проведения мастер-класса")
    if db.scalar(select(Review.id).where(Review.booking_id == booking.id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Отзыв на эту запись уже оставлен")

    review = Review(
        booking_id=booking.id,
        workshop_id=workshop.id,
        client_id=client.id,
        rating=data.rating,
        comment=data.comment,
    )
    db.add(review)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Отзыв на эту запись уже оставлен")
    log_action(db, client.id, EntityType.review, review.id, Action.created,
               f"Мастер-класс #{workshop.id}, оценка: {review.rating}")
    db.commit()
    return review
