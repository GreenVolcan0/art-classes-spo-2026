from typing import Optional

from sqlalchemy.orm import Session

from app.enums import Action, EntityType
from app.models import ActionLog


def log_action(
    db: Session,
    user_id: Optional[int],
    entity_type: EntityType,
    entity_id: int,
    action: Action,
    details: Optional[str] = None,
) -> None:
    """Запись в журнал действий. Коммит делает вызывающий код — запись попадает в ту же транзакцию."""
    db.add(
        ActionLog(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            details=details,
        )
    )
