from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.enums import Role
from app.models import Review, User, Workshop
from app.schemas import MasterPublic, Page, ReviewOut

router = APIRouter(prefix="/masters", tags=["masters"])


def master_rating(db: Session, master_id: int) -> tuple[float | None, int]:
    """Средняя оценка по всем мастер-классам мастера; скрытые отзывы не учитываются."""
    avg, count = db.execute(
        select(func.avg(Review.rating), func.count(Review.id))
        .join(Workshop, Review.workshop_id == Workshop.id)
        .where(Workshop.master_id == master_id, Review.is_hidden.is_(False))
    ).one()
    return (round(float(avg), 2) if avg is not None else None), count


def _get_public_master(db: Session, master_id: int) -> User:
    master = db.get(User, master_id)
    if master is None or master.role != Role.master or not master.is_active or not master.is_approved:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Мастер не найден")
    return master


@router.get("/{master_id}", response_model=MasterPublic)
def get_master(master_id: int, db: Session = Depends(get_db)):
    master = _get_public_master(db, master_id)
    rating, count = master_rating(db, master.id)
    return MasterPublic(
        id=master.id,
        first_name=master.first_name,
        last_name=master.last_name,
        phone=master.phone,
        bio=master.bio,
        rating=rating,
        reviews_count=count,
    )


@router.get("/{master_id}/reviews", response_model=Page[ReviewOut])
def get_master_reviews(
    master_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    master = _get_public_master(db, master_id)
    filters = [Workshop.master_id == master.id, Review.is_hidden.is_(False)]
    total = db.scalar(
        select(func.count(Review.id)).join(Workshop, Review.workshop_id == Workshop.id).where(*filters)
    )
    items = db.scalars(
        select(Review)
        .join(Workshop, Review.workshop_id == Workshop.id)
        .where(*filters)
        .options(joinedload(Review.client))
        .order_by(Review.created_at.desc(), Review.id.desc())
        .offset(offset)
        .limit(limit)
    ).all()
    return Page[ReviewOut](items=items, total=total or 0, limit=limit, offset=offset)
