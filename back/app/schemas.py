from datetime import datetime
from decimal import Decimal
from typing import Annotated, Generic, Optional, TypeVar

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, field_validator

from app.enums import Action, BookingStatus, EntityType, Role, WorkshopStatus

T = TypeVar("T")

# Цена в JSON отдаётся числом (а не строкой, как Decimal по умолчанию)
Price = Annotated[Decimal, PlainSerializer(lambda v: float(v), return_type=float, when_used="json")]


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int


def _check_password(value: str) -> str:
    # bcrypt учитывает только первые 72 байта — длиннее не принимаем
    if len(value.encode("utf-8")) > 72:
        raise ValueError("Пароль слишком длинный (максимум 72 байта)")
    return value


# ---------- Пользователи ----------

class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    first_name: str = Field(min_length=1, max_length=100)
    last_name: str = Field(min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=32)
    role: Role
    bio: Optional[str] = None

    @field_validator("password")
    @classmethod
    def _password_len(cls, v: str) -> str:
        return _check_password(v)

    @field_validator("email")
    @classmethod
    def _lower_email(cls, v: str) -> str:
        return v.lower()

    @field_validator("role")
    @classmethod
    def _no_admin(cls, v: Role) -> Role:
        if v == Role.admin:
            raise ValueError("Администратором через регистрацию стать нельзя")
        return v


class LoginIn(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def _normalize_email(cls, v: str) -> str:
        return v.strip().lower()


class UserOut(ORMModel):
    id: int
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]
    role: Role
    is_active: bool
    is_approved: bool
    bio: Optional[str]
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserUpdate(BaseModel):
    first_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    phone: Optional[str] = Field(default=None, max_length=32)
    bio: Optional[str] = None


class PersonBrief(ORMModel):
    id: int
    first_name: str
    last_name: str


class ClientContact(ORMModel):
    id: int
    first_name: str
    last_name: str
    email: str
    phone: Optional[str]


class MasterPublic(BaseModel):
    id: int
    first_name: str
    last_name: str
    phone: Optional[str]
    bio: Optional[str]
    rating: Optional[float]
    reviews_count: int


# ---------- Категории ----------

class CategoryIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    description: Optional[str] = None


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    description: Optional[str] = None


class CategoryOut(ORMModel):
    id: int
    name: str
    description: Optional[str]


# ---------- Мастер-классы ----------

class WorkshopIn(BaseModel):
    category_id: int
    title: str = Field(min_length=3, max_length=200)
    description: str = Field(min_length=1)
    location: str = Field(min_length=1, max_length=255)
    start_at: datetime
    duration_min: int = Field(gt=0, le=1440)
    price: Decimal = Field(ge=0, max_digits=10, decimal_places=2)
    capacity: int = Field(ge=1, le=1000)


class WorkshopUpdate(BaseModel):
    category_id: Optional[int] = None
    title: Optional[str] = Field(default=None, min_length=3, max_length=200)
    description: Optional[str] = Field(default=None, min_length=1)
    location: Optional[str] = Field(default=None, min_length=1, max_length=255)
    start_at: Optional[datetime] = None
    duration_min: Optional[int] = Field(default=None, gt=0, le=1440)
    price: Optional[Decimal] = Field(default=None, ge=0, max_digits=10, decimal_places=2)
    capacity: Optional[int] = Field(default=None, ge=1, le=1000)


class WorkshopOut(ORMModel):
    id: int
    master: PersonBrief
    category: CategoryOut
    title: str
    description: str
    location: str
    start_at: datetime
    duration_min: int
    price: Price
    capacity: int
    free_seats: int = 0
    status: WorkshopStatus
    reject_reason: Optional[str]
    created_at: datetime
    updated_at: datetime


class WorkshopBrief(ORMModel):
    id: int
    title: str
    location: str
    start_at: datetime
    duration_min: int
    price: Price
    status: WorkshopStatus
    master: PersonBrief


class RejectIn(BaseModel):
    reason: str = Field(min_length=1, max_length=2000)


# ---------- Брони ----------

class BookingCreate(BaseModel):
    # Если мест нет, клиент должен явно согласиться на лист ожидания
    join_waitlist: bool = False


class BookingOut(ORMModel):
    id: int
    workshop: WorkshopBrief
    status: BookingStatus
    created_at: datetime
    cancelled_at: Optional[datetime]
    review_id: Optional[int] = None


class ParticipantOut(BaseModel):
    booking_id: int
    status: BookingStatus
    created_at: datetime
    client: ClientContact


class ParticipantsOut(BaseModel):
    capacity: int
    free_seats: int
    confirmed: list[ParticipantOut]
    waitlist: list[ParticipantOut]


# ---------- Отзывы ----------

class ReviewIn(BaseModel):
    rating: int = Field(ge=1, le=5)
    comment: Optional[str] = Field(default=None, max_length=2000)


class ReviewOut(ORMModel):
    id: int
    booking_id: int
    workshop_id: int
    client: PersonBrief
    rating: int
    comment: Optional[str]
    is_hidden: bool
    created_at: datetime


# ---------- Журнал ----------

class ActionLogOut(ORMModel):
    id: int
    user: Optional[PersonBrief]
    entity_type: EntityType
    entity_id: int
    action: Action
    details: Optional[str]
    created_at: datetime
