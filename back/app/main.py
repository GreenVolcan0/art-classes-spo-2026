import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import SessionLocal
from app.init_db import init_db
from app.routers import admin, auth, bookings, categories, masters, users, workshops
from app.services.workshops import finish_past_workshops


def _finisher_loop(stop: threading.Event, interval: float = 60.0) -> None:
    """Раз в минуту переводит прошедшие мастер-классы published → finished."""
    while not stop.wait(interval):
        try:
            with SessionLocal() as db:
                finish_past_workshops(db)
        except Exception:  # noqa: BLE001 — фоновая задача не должна падать
            pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    stop = threading.Event()
    threading.Thread(target=_finisher_loop, args=(stop,), daemon=True).start()
    yield
    stop.set()


app = FastAPI(title="Бронирование мастер-классов", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for router in (auth.router, users.router, masters.router, categories.router,
               workshops.router, bookings.router, admin.router):
    app.include_router(router, prefix="/api")


@app.get("/api/health", tags=["system"])
def health():
    return {"status": "ok"}
