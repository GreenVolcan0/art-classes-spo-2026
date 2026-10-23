from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.enums import Action, EntityType, Role
from app.models import Category, User, Workshop
from app.schemas import CategoryIn, CategoryOut, CategoryUpdate
from app.services.audit import log_action

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.name)).all()


@router.post("", response_model=CategoryOut, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryIn,
    admin: User = Depends(require_roles(Role.admin)),
    db: Session = Depends(get_db),
):
    category = Category(name=data.name.strip(), description=data.description)
    db.add(category)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Категория с таким названием уже существует")
    log_action(db, admin.id, EntityType.category, category.id, Action.created, f"Категория «{category.name}»")
    db.commit()
    return category


@router.patch("/{category_id}", response_model=CategoryOut)
def update_category(
    category_id: int,
    data: CategoryUpdate,
    admin: User = Depends(require_roles(Role.admin)),
    db: Session = Depends(get_db),
):
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Категория не найдена")
    changes = data.model_dump(exclude_unset=True)
    if changes.get("name") is None:
        changes.pop("name", None)
    for field, value in changes.items():
        setattr(category, field, value.strip() if field == "name" else value)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "Категория с таким названием уже существует")
    log_action(db, admin.id, EntityType.category, category.id, Action.updated,
               "Изменены поля: " + ", ".join(sorted(changes)))
    db.commit()
    return category


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    admin: User = Depends(require_roles(Role.admin)),
    db: Session = Depends(get_db),
):
    """Категорию с привязанными мастер-классами удалить нельзя."""
    category = db.get(Category, category_id)
    if category is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Категория не найдена")
    if db.scalar(select(Workshop.id).where(Workshop.category_id == category_id).limit(1)):
        raise HTTPException(status.HTTP_409_CONFLICT, "К категории привязаны мастер-классы, удалить нельзя")
    log_action(db, admin.id, EntityType.category, category.id, Action.deleted, f"Категория «{category.name}»")
    db.delete(category)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
