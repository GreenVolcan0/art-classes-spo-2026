import enum


class Role(enum.StrEnum):
    client = "client"
    master = "master"
    admin = "admin"


class WorkshopStatus(enum.StrEnum):
    draft = "draft"
    pending = "pending"
    published = "published"
    rejected = "rejected"
    cancelled = "cancelled"
    finished = "finished"


class BookingStatus(enum.StrEnum):
    confirmed = "confirmed"
    waitlisted = "waitlisted"
    cancelled = "cancelled"


class EntityType(enum.StrEnum):
    workshop = "workshop"
    booking = "booking"
    user = "user"
    review = "review"
    category = "category"


class Action(enum.StrEnum):
    created = "created"
    updated = "updated"
    deleted = "deleted"
    approved = "approved"
    rejected = "rejected"
    cancelled = "cancelled"
