from datetime import datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.enums import Action, BookingStatus, EntityType, Role, WorkshopStatus


def _enum(enum_cls):
    # Храним как VARCHAR (не нативный enum PostgreSQL) — проще менять значения.
    return SAEnum(enum_cls, native_enum=False, length=20, validate_strings=True)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    first_name: Mapped[str] = mapped_column(String(100))
    last_name: Mapped[str] = mapped_column(String(100))
    phone: Mapped[Optional[str]] = mapped_column(String(32))
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[Role] = mapped_column(_enum(Role), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    # Для клиентов и админов всегда true; у мастера — подтверждён ли админом
    is_approved: Mapped[bool] = mapped_column(Boolean, default=True, server_default=text("true"))
    bio: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    description: Mapped[Optional[str]] = mapped_column(Text)


class Workshop(Base):
    __tablename__ = "workshops"
    __table_args__ = (
        CheckConstraint("capacity > 0", name="ck_workshops_capacity_positive"),
        CheckConstraint("price >= 0", name="ck_workshops_price_non_negative"),
        CheckConstraint("duration_min > 0", name="ck_workshops_duration_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    master_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(255))
    start_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    duration_min: Mapped[int] = mapped_column(Integer)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    capacity: Mapped[int] = mapped_column(Integer)
    status: Mapped[WorkshopStatus] = mapped_column(
        _enum(WorkshopStatus), default=WorkshopStatus.draft, index=True
    )
    reject_reason: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    master: Mapped["User"] = relationship()
    category: Mapped["Category"] = relationship()


class Booking(Base):
    __tablename__ = "bookings"
    __table_args__ = (
        # Не больше одной активной брони клиента на мастер-класс (страховка на уровне БД)
        Index(
            "uq_bookings_active_per_client",
            "workshop_id",
            "client_id",
            unique=True,
            postgresql_where=text("status IN ('confirmed', 'waitlisted')"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    workshop_id: Mapped[int] = mapped_column(ForeignKey("workshops.id"), index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    status: Mapped[BookingStatus] = mapped_column(_enum(BookingStatus), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    cancelled_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True))

    workshop: Mapped["Workshop"] = relationship()
    client: Mapped["User"] = relationship()
    review: Mapped[Optional["Review"]] = relationship(back_populates="booking", uselist=False)

    @property
    def review_id(self) -> Optional[int]:
        return self.review.id if self.review else None


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        CheckConstraint("rating BETWEEN 1 AND 5", name="ck_reviews_rating_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    booking_id: Mapped[int] = mapped_column(ForeignKey("bookings.id"), unique=True)
    workshop_id: Mapped[int] = mapped_column(ForeignKey("workshops.id"), index=True)
    client_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    rating: Mapped[int] = mapped_column(Integer)
    comment: Mapped[Optional[str]] = mapped_column(Text)
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default=text("false"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    booking: Mapped["Booking"] = relationship(back_populates="review")
    client: Mapped["User"] = relationship()


class ActionLog(Base):
    __tablename__ = "action_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), index=True)
    entity_type: Mapped[EntityType] = mapped_column(_enum(EntityType), index=True)
    entity_id: Mapped[int] = mapped_column(Integer)
    action: Mapped[Action] = mapped_column(_enum(Action), index=True)
    details: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )

    user: Mapped[Optional["User"]] = relationship()
