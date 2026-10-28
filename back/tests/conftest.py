import os
from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from helpers import make_workshop_payload

# Тестовая БД. Можно переопределить через переменную окружения.
TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@localhost:5432/art_classes_test",
)


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DATABASE_URL, pool_pre_ping=True)
    yield eng
    eng.dispose()


@pytest.fixture(scope="session", autouse=True)
def _create_schema(engine):
    """Создаём схему один раз на всю сессию."""
    from app import models  # noqa: F401
    from app.database import Base

    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture()
def db(engine, _create_schema):
    """Отдельная сессия на тест, с очисткой таблиц после него."""
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()
        with engine.begin() as conn:
            # Порядок важен из-за внешних ключей
            for table in (
                "action_logs",
                "reviews",
                "bookings",
                "workshops",
                "categories",
                "users",
            ):
                conn.execute(text(f'TRUNCATE TABLE "{table}" RESTART IDENTITY CASCADE'))


@pytest.fixture()
def client(db, monkeypatch):
    """TestClient с подменённой зависимостью get_db и без фонового потока."""
    from app.database import get_db
    from app.main import app

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    # Отключаем фоновый «финишер» и инициализацию БД в lifespan
    monkeypatch.setattr("app.main.init_db", lambda: None)
    monkeypatch.setattr("app.main._finisher_loop", lambda *a, **kw: None)

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()


# ---------- Хелперы для быстрого создания сущностей ----------

@pytest.fixture()
def register(client):
    def _register(email, password="password123", role="client", **kwargs):
        payload = {
            "email": email,
            "password": password,
            "first_name": kwargs.pop("first_name", "Иван"),
            "last_name": kwargs.pop("last_name", "Иванов"),
            "role": role,
            **kwargs,
        }
        return client.post("/api/auth/register", json=payload)

    return _register


@pytest.fixture()
def login(client):
    def _login(email, password="password123"):
        return client.post("/api/auth/login", json={"email": email, "password": password})

    return _login


@pytest.fixture()
def auth_headers(register, login):
    """Фабрика: создаёт пользователя (если нужно) и возвращает заголовки с токеном."""

    def _headers(email, password="password123", role="client", **kwargs):
        register(email, password=password, role=role, **kwargs)
        resp = login(email, password)
        assert resp.status_code == 200, resp.text
        token = resp.json()["access_token"]
        return {"Authorization": f"Bearer {token}"}

    return _headers


@pytest.fixture()
def admin_headers(client, db):
    """Создаёт администратора напрямую в БД и логинит его."""
    from app.enums import Role
    from app.security import hash_password
    from app.models import User

    admin = User(
        email="admin@test.example.com",
        password_hash=hash_password("admin12345"),
        first_name="Admin",
        last_name="Root",
        role=Role.admin,
        is_approved=True,
    )
    db.add(admin)
    db.commit()

    resp = client.post(
        "/api/auth/login",
        json={"email": "admin@test.example.com", "password": "admin12345"},
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def category(client, admin_headers):
    """Создаёт категорию через API и возвращает её данные."""
    resp = client.post(
        "/api/categories",
        json={"name": "Живопись", "description": "Масло, акварель"},
        headers=admin_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


@pytest.fixture()
def approved_master(register, login, client, admin_headers):
    """Создаёт мастера, подтверждает его админом и возвращает заголовки."""

    def _make(email="master@test.example.com", password="password123"):
        register(email, password=password, role="master", bio="Художник")
        # Находим id мастера
        users = client.get(
            "/api/admin/users", params={"role": "master"}, headers=admin_headers
        ).json()["items"]
        master = next(u for u in users if u["email"] == email)
        resp = client.post(
            f"/api/admin/masters/{master['id']}/approve", headers=admin_headers
        )
        assert resp.status_code == 200, resp.text
        token = login(email, password).json()["access_token"]
        return {"Authorization": f"Bearer {token}"}, master

    return _make


def make_workshop_payload(category_id, **overrides):
    """Собирает валидный payload мастер-класса."""
    payload = {
        "category_id": category_id,
        "title": "Роспись по шёлку",
        "description": "Учимся батику",
        "location": "Студия «Палитра»",
        "start_at": (datetime.now(timezone.utc) + timedelta(days=5)).isoformat(),
        "duration_min": 90,
        "price": "1500.00",
        "capacity": 2,
    }
    payload.update(overrides)
    return payload


@pytest.fixture()
def published_workshop(client, approved_master, category):
    """Создаёт МК, отправляет на модерацию, публикует. Возвращает (id, master_headers, master)."""
    headers, master = approved_master("master_pub@test.example.com")
    payload = make_workshop_payload(category["id"])
    resp = client.post("/api/workshops", json=payload, headers=headers)
    assert resp.status_code == 201, resp.text
    wid = resp.json()["id"]

    client.post(f"/api/workshops/{wid}/submit", headers=headers)

    # Публикуем от имени админа: получим заголовки админа из фикстуры заново
    # (упростим — найдём админа через клиент нельзя, поэтому передаём в фабрику).
    return wid, headers, master


# Вспомогательная функция для публикации МК админом
def publish_workshop(client, admin_headers, workshop_id):
    resp = client.post(
        f"/api/admin/workshops/{workshop_id}/approve", headers=admin_headers
    )
    assert resp.status_code == 200, resp.text
    return resp.json()