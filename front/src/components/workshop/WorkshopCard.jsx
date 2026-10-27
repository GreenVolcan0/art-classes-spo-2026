import { Badge, Card } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { formatDateTime, formatDuration, formatPrice, personName } from '../../utils/format';
import StatusBadge from '../ui/StatusBadge';

/**
 * Карточка мастер-класса для каталога.
 */
export default function WorkshopCard({ workshop, showStatus = false }) {
  const w = workshop;
  return (
    <Card className="h-100 workshop-card shadow-sm">
      <Card.Body className="d-flex flex-column">
        <div className="d-flex justify-content-between align-items-start mb-2 gap-2">
          {w.category ? (
            <Badge bg="light" text="primary" className="border fw-normal">
              {w.category.name}
            </Badge>
          ) : (
            <span />
          )}
          {showStatus && <StatusBadge value={w.status} />}
        </div>

        <Card.Title as="h6" className="mb-2 fs-6">
          <Link to={`/workshops/${w.id}`} className="text-reset fw-bold">
            {w.title}
          </Link>
        </Card.Title>

        <Card.Text className="text-muted small desc-clamp mb-3">{w.description}</Card.Text>

        <ul className="list-unstyled small text-muted mb-0 mt-auto">
          <li className="mb-1">
            <i className="bi bi-calendar-event me-2 text-primary" />
            {formatDateTime(w.start_at)}
          </li>
          <li className="mb-1">
            <i className="bi bi-clock me-2 text-primary" />
            {formatDuration(w.duration_min)}
          </li>
          <li className="mb-1">
            <i className="bi bi-geo-alt me-2 text-primary" />
            {w.location}
          </li>
          <li>
            <i className="bi bi-person me-2 text-primary" />
            {personName(w.master)}
          </li>
        </ul>
      </Card.Body>

      <Card.Footer className="d-flex justify-content-between align-items-center bg-white pt-0 border-top-0">
        <span className="fw-bold text-primary">{formatPrice(w.price)}</span>
        <span className="small">
          {w.free_seats > 0 ? (
            <span className="text-success">
              <i className="bi bi-check-circle me-1" />
              свободно: {w.free_seats} из {w.capacity}
            </span>
          ) : (
            <span className="text-danger">
              <i className="bi bi-x-circle me-1" />
              мест нет
            </span>
          )}
        </span>
      </Card.Footer>
    </Card>
  );
}
