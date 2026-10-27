import Badge from 'react-bootstrap/Badge';
import { ACTION, BOOKING_STATUS, ROLE, WORKSHOP_STATUS } from '../../utils/constants';

const MAPS = {
  workshop: WORKSHOP_STATUS,
  booking: BOOKING_STATUS,
  role: ROLE,
  action: ACTION,
};

/**
 * Цветной бейдж статуса мастер-класса, брони или роли.
 * <StatusBadge type="workshop" value="published" />
 */
export default function StatusBadge({ type = 'workshop', value, className = '' }) {
  const cfg = MAPS[type]?.[value];
  if (!cfg) return null;
  const needDarkText = cfg.bg === 'warning' || cfg.bg === 'info' || cfg.bg === 'light';
  return (
    <Badge bg={cfg.bg} className={`${needDarkText ? 'text-dark ' : ''}${className}`}>
      {cfg.label}
    </Badge>
  );
}
