from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.enums import Action, EntityType, Role
from app.models import User
from app.schemas import UserOut, UserUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
def update_me(data: UserUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Редактирование своего профиля (любая роль). Поле bio осмысленно только для мастера."""
    changes = data.model_dump(exclude_unset=True)
    # Обязательные поля нельзя занулить
    for field in ("first_name", "last_name"):
        if field in changes and changes[field] is None:
            del changes[field]
    if user.role != Role.master:
        changes.pop("bio", None)

    for field, value in changes.items():
        setattr(user, field, value)
    if changes:
        log_action(db, user.id, EntityType.user, user.id, Action.updated,
                   "Профиль изменён: " + ", ".join(sorted(changes)))
    db.commit()
    return user
