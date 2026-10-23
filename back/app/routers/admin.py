from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.deps import require_roles
from app.enums import Action, EntityType, Role, WorkshopStatus
from app.models import ActionLog, Review, User, Workshop
from app.schemas import ActionLogOut, Page, RejectIn, ReviewOut, UserOut, WorkshopOut
from app.services.audit import log_action
from app.services.workshops import (
    confirmed_count_expr,
    finish_past_workshops,
    lock_workshop,
    utcnow,
    workshop_out,
)

router = APIRouter(prefix="/admin", tags=["admin"])

AdminUser = Depends(require_roles(Role.admin))


def _get_user(db: Session, user_id: int) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Пользователь не найден")
    return user


# ---------------------------------------------------------------- пользователи

@router.get("/users", response_model=Page[UserOut])
def list_users(
    role: Optional[Role] = None,
    is_approved: Optional[bool] = None,
    is_active: Optional[bool] = None,
    q: Optional[str] = Query(None, description="Поиск по email, имени и фамилии"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = AdminUser,
    db: Session = Depends(get_db),
):
    filters = []
    if role is not None:
        filters.append(User.role == role)
    if is_approved is not None:
        filters.append(User.is_approved.is_(is_approved))
    if is_active is not None:
        filters.append(User.is_active.is_(is_active))
    if q:
        filters.append(
            or_(
                User.email.icontains(q, autoescape=True),
                User.first_name.icontains(q, autoescape=True),
                User.last_name.icontains(q, autoescape=True),
            )
        )
    total = db.scalar(select(func.count(User.id)).where(*filters))
    items = db.scalars(
        select(User).where(*filters).order_by(User.created_at.desc(), User.id.desc()).offset(offset).limit(limit)
    ).all()
    return Page[UserOut](items=items, total=total or 0, limit=limit, offset=offset)


@router.post("/masters/{user_id}/approve", response_model=UserOut)
def approve_master(user_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    """Подтверждение учётной записи мастера: после этого он может отправлять мастер-классы на модерацию."""
    user = _get_user(db, user_id)
    if user.role != Role.master:
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь не является мастером")
    if user.is_approved:
        raise HTTPException(status.HTTP_409_CONFLICT, "Мастер уже подтверждён")
    user.is_approved = True
    log_action(db, admin.id, EntityType.user, user.id, Action.approved, "Учётная запись мастера подтверждена")
    db.commit()
    return user


@router.post("/users/{user_id}/block", response_model=UserOut)
def block_user(user_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    if user_id == admin.id:
        raise HTTPException(status.HTTP_409_CONFLICT, "Нельзя заблокировать самого себя")
    user = _get_user(db, user_id)
    if not user.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь уже заблокирован")
    user.is_active = False
    log_action(db, admin.id, EntityType.user, user.id, Action.updated, "Пользователь заблокирован (is_active: true → false)")
    db.commit()
    return user


@router.post("/users/{user_id}/unblock", response_model=UserOut)
def unblock_user(user_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    user = _get_user(db, user_id)
    if user.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь не заблокирован")
    user.is_active = True
    log_action(db, admin.id, EntityType.user, user.id, Action.updated, "Пользователь разблокирован (is_active: false → true)")
    db.commit()
    return user


@router.post("/users/{user_id}/make-admin", response_model=UserOut)
def make_admin(user_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    """Назначение нового администратора делает существующий администратор."""
    user = _get_user(db, user_id)
    if user.role == Role.admin:
        raise HTTPException(status.HTTP_409_CONFLICT, "Пользователь уже администратор")
    if not user.is_active:
        raise HTTPException(status.HTTP_409_CONFLICT, "Нельзя назначить администратором заблокированного пользователя")
    previous = user.role.value
    user.role = Role.admin
    user.is_approved = True
    log_action(db, admin.id, EntityType.user, user.id, Action.updated, f"Роль изменена: {previous} → admin")
    db.commit()
    return user


# ---------------------------------------------------------------- модерация мастер-классов

@router.get("/workshops", response_model=Page[WorkshopOut])
def list_workshops(
    status_filter: Optional[WorkshopStatus] = Query(None, alias="status", description="Например, pending — очередь модерации"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = AdminUser,
    db: Session = Depends(get_db),
):
    finish_past_workshops(db)
    filters = []
    if status_filter is not None:
        filters.append(Workshop.status == status_filter)
    total = db.scalar(select(func.count(Workshop.id)).where(*filters))
    rows = db.execute(
        select(Workshop, confirmed_count_expr())
        .where(*filters)
        .options(joinedload(Workshop.master), joinedload(Workshop.category))
        .order_by(Workshop.updated_at.desc(), Workshop.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return Page[WorkshopOut](
        items=[workshop_out(w, c) for w, c in rows], total=total or 0, limit=limit, offset=offset
    )


@router.post("/workshops/{workshop_id}/approve", response_model=WorkshopOut)
def approve_workshop(workshop_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    """pending → published."""
    workshop = lock_workshop(db, workshop_id)
    if workshop.status != WorkshopStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "Одобрить можно только мастер-класс на модерации")
    if workshop.start_at <= utcnow():
        raise HTTPException(status.HTTP_409_CONFLICT, "Время начала уже прошло — отклоните мастер-класс")
    workshop.status = WorkshopStatus.published
    workshop.reject_reason = None
    log_action(db, admin.id, EntityType.workshop, workshop.id, Action.approved, "Мастер-класс опубликован")
    db.commit()

    from app.routers.workshops import load_workshop_out

    return load_workshop_out(db, workshop.id)


@router.post("/workshops/{workshop_id}/reject", response_model=WorkshopOut)
def reject_workshop(workshop_id: int, data: RejectIn, admin: User = AdminUser, db: Session = Depends(get_db)):
    """pending → rejected с указанием причины; мастер может исправить и отправить снова."""
    workshop = lock_workshop(db, workshop_id)
    if workshop.status != WorkshopStatus.pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "Отклонить можно только мастер-класс на модерации")
    workshop.status = WorkshopStatus.rejected
    workshop.reject_reason = data.reason.strip()
    log_action(db, admin.id, EntityType.workshop, workshop.id, Action.rejected, f"Причина: {workshop.reject_reason}")
    db.commit()

    from app.routers.workshops import load_workshop_out

    return load_workshop_out(db, workshop.id)


# ---------------------------------------------------------------- отзывы

@router.get("/reviews", response_model=Page[ReviewOut])
def list_reviews(
    is_hidden: Optional[bool] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    admin: User = AdminUser,
    db: Session = Depends(get_db),
):
    filters = []
    if is_hidden is not None:
        filters.append(Review.is_hidden.is_(is_hidden))
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


def _set_review_hidden(db: Session, admin: User, review_id: int, hidden: bool) -> Review:
    review = db.get(Review, review_id)
    if review is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Отзыв не найден")
    if review.is_hidden == hidden:
        raise HTTPException(status.HTTP_409_CONFLICT, "Отзыв уже скрыт" if hidden else "Отзыв не скрыт")
    review.is_hidden = hidden
    log_action(db, admin.id, EntityType.review, review.id, Action.updated,
               f"is_hidden: {str(not hidden).lower()} → {str(hidden).lower()}")
    db.commit()
    return review


@router.post("/reviews/{review_id}/hide", response_model=ReviewOut)
def hide_review(review_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    return _set_review_hidden(db, admin, review_id, True)


@router.post("/reviews/{review_id}/unhide", response_model=ReviewOut)
def unhide_review(review_id: int, admin: User = AdminUser, db: Session = Depends(get_db)):
    return _set_review_hidden(db, admin, review_id, False)


# ---------------------------------------------------------------- журнал действий

@router.get("/logs", response_model=Page[ActionLogOut])
def list_logs(
    entity_type: Optional[EntityType] = None,
    entity_id: Optional[int] = None,
    action: Optional[Action] = None,
    user_id: Optional[int] = None,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    admin: User = AdminUser,
    db: Session = Depends(get_db),
):
    filters = []
    if entity_type is not None:
        filters.append(ActionLog.entity_type == entity_type)
    if entity_id is not None:
        filters.append(ActionLog.entity_id == entity_id)
    if action is not None:
        filters.append(ActionLog.action == action)
    if user_id is not None:
        filters.append(ActionLog.user_id == user_id)
    total = db.scalar(select(func.count(ActionLog.id)).where(*filters))
    items = db.scalars(
        select(ActionLog)
        .where(*filters)
        .options(joinedload(ActionLog.user))
        .order_by(ActionLog.created_at.desc(), ActionLog.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return Page[ActionLogOut](items=items, total=total or 0, limit=limit, offset=offset)
