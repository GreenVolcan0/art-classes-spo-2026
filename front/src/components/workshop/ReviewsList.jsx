import { formatDate, personName } from '../../utils/format';
import RatingStars from '../ui/RatingStars';
import EmptyState from '../ui/EmptyState';

/**
 * Список отзывов (используется на странице МК и в публичном профиле мастера).
 */
export default function ReviewsList({ reviews, emptyText }) {
  if (!reviews || reviews.length === 0) {
    return (
      <EmptyState
        icon="bi-chat-square-text"
        title="Отзывов пока нет"
        text={emptyText || 'Станьте первым, кто поделится впечатлениями!'}
      />
    );
  }

  return (
    <div>
      {reviews.map((r) => (
        <div key={r.id} className="border-bottom py-3">
          <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
            <div>
              <RatingStars value={r.rating} />
              <span className="fw-semibold ms-2">{personName(r.client)}</span>
            </div>
            <span className="small text-muted">{formatDate(r.created_at)}</span>
          </div>
          {r.comment && <p className="mb-0 mt-1">{r.comment}</p>}
        </div>
      ))}
    </div>
  );
}
