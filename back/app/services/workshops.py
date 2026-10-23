from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.enums import Action, BookingStatus, EntityType, WorkshopStatus
from app.models import Booking, Workshop
from app.schemas import WorkshopOut
from app.services.audit import log_action

ACTIVE_BOOKING_STATUSES = (BookingStatus.confirmed, BookingStatus.waitlisted)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(dt: datetime) -> datetime:
    """Наивное время считаем UTC, aware — приводим к UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def confirmed_count_expr():
    """Коррелированный подзапрос: число подтверждённых броней мастер-класса."""
    return (
        select(func.count(Booking.id))
        .where(Booking.workshop_id == Workshop.id, Booking.status == BookingStatus.confirmed)
        .correlate(Workshop)
        .scalar_subquery()
    )


def confirmed_count(db: Session, workshop_id: int) -> int:
    return (
        db.scalar(
            select(func.count(Booking.id)).where(
                Booking.workshop_id == workshop_id, Booking.status == BookingStatus.confirmed
            )
        )
        or 0
    )


def lock_workshop(db: Session, workshop_id: int) -> Workshop:
    """SELECT ... FOR UPDATE: защита от перебронирования и гонок при отмене/переносе из очереди."""
    workshop = db.scalar(
        select(Workshop)
        .where(Workshop.id == workshop_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    if workshop is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Мастер-класс не найден")
    return workshop


def finish_past_workshops(db: Session) -> None:
    """published → finished, когда время начала + длительность прошли."""
    db.execute(
        update(Workshop)
        .where(
            Workshop.status == WorkshopStatus.published,
            Workshop.start_at + func.make_interval(0, 0, 0, 0, 0, Workshop.duration_min)
            <= func.now(),
        )
        .values(status=WorkshopStatus.finished)
        .execution_options(synchronize_session=False)
    )
    db.commit()


def promote_from_waitlist(db: Session, workshop: Workshop, acting_user_id: int) -> list[Booking]:
    """Переводит в confirmed первых из очереди, пока есть свободные места (в той же транзакции)."""
    free = workshop.capacity - confirmed_count(db, workshop.id)
    if free <= 0:
        return []
    queue = db.scalars(
        select(Booking)
        .where(Booking.workshop_id == workshop.id, Booking.status == BookingStatus.waitlisted)
        .order_by(Booking.created_at, Booking.id)
        .limit(free)
    ).all()
    for booking in queue:
        booking.status = BookingStatus.confirmed
        log_action(
            db,
            acting_user_id,
            EntityType.booking,
            booking.id,
            Action.updated,
            f"Место освободилось: бронь переведена из листа ожидания (waitlisted → confirmed), "
            f"мастер-класс #{workshop.id}",
        )
    db.flush()
    return list(queue)


def workshop_out(workshop: Workshop, confirmed: int) -> WorkshopOut:
    out = WorkshopOut.model_validate(workshop)
    out.free_seats = max(workshop.capacity - confirmed, 0)
    return out
