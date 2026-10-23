import time

from sqlalchemy import select
from sqlalchemy.exc import OperationalError

from app import models  # noqa: F401  — регистрирует таблицы в Base.metadata
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.enums import Action, EntityType, Role
from app.models import User
from app.security import hash_password
from app.services.audit import log_action


def wait_for_db(attempts: int = 30, delay: float = 2.0) -> None:
    """БД в docker-compose может подняться позже бэкенда — ждём."""
    for _ in range(attempts):
        try:
            with engine.connect():
                return
        except OperationalError:
            time.sleep(delay)
    raise RuntimeError("Не удалось подключиться к базе данных")


def create_first_admin() -> None:
    """Первый администратор создаётся при инициализации БД (через регистрацию админом стать нельзя)."""
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.role == Role.admin).limit(1)):
            return
        admin = User(
            email=settings.first_admin_email.lower(),
            password_hash=hash_password(settings.first_admin_password),
            first_name=settings.first_admin_first_name,
            last_name=settings.first_admin_last_name,
            role=Role.admin,
            is_approved=True,
        )
        db.add(admin)
        db.flush()
        log_action(db, admin.id, EntityType.user, admin.id, Action.created, "Первый администратор (инициализация БД)")
        db.commit()


def init_db() -> None:
    wait_for_db()
    Base.metadata.create_all(engine)
    create_first_admin()
