import { useCallback, useEffect, useState } from 'react';
import { Badge, Button, Form, ListGroup, Modal, Nav } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { bookingsApi } from '../api/api';
import { getApiError } from '../api/client';
import { useToast } from '../context/ToastContext';
import ConfirmModal from '../components/ui/ConfirmModal';
import EmptyState from '../components/ui/EmptyState';
import ErrorAlert from '../components/ui/ErrorAlert';
import Loading from '../components/ui/Loading';
import RatingInput from '../components/ui/RatingInput';
import StatusBadge from '../components/ui/StatusBadge';
import { CANCEL_DEADLINE_HOURS } from '../utils/constants';
import { formatDateTime, formatDuration, hoursUntil, personName } from '../utils/format';

const PAGE_SIZE = 20;

const STATUS_TABS = [
  { value: '', label: 'Все' },
  { value: 'confirmed', label: 'Подтверждённые' },
  { value: 'waitlisted', label: 'Лист ожидания' },
  { value: 'cancelled', label: 'Отменённые' },
];

export default function MyBookingsPage() {
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // отмена брони
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  // отзыв
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 0, comment: '' });
  const [reviewSaving, setReviewSaving] = useState(false);

  const load = useCallback(
    async (status, off) => {
      setLoading(true);
      setError('');
      try {
        const params = { limit: PAGE_SIZE, offset: off };
        if (status) params.status = status;
        const { data } = await bookingsApi.my(params);
        setItems(data.items ?? []);
        setTotal(data.total);
      } catch (e) {
        setError(getApiError(e));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    load(statusFilter, 0);
    setOffset(0);
  }, [statusFilter, load]);

  const changePage = (newOffset) => {
    setOffset(newOffset);
    load(statusFilter, newOffset);
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await bookingsApi.cancel(cancelTarget.id);
      toast('Бронь отменена', 'warning');
      setCancelTarget(null);
      load(statusFilter, offset);
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setCancelLoading(false);
    }
  };

  const openReview = (booking) => {
    setReviewTarget(booking);
    setReviewForm({ rating: 0, comment: '' });
  };

  const submitReview = async () => {
    if (!reviewForm.rating) {
      toast('Поставьте оценку от 1 до 5 звёзд', 'warning');
      return;
    }
    setReviewSaving(true);
    try {
      await bookingsApi.review(reviewTarget.id, {
        rating: reviewForm.rating,
        comment: reviewForm.comment.trim() || null,
      });
      toast('Спасибо за отзыв!', 'success');
      setReviewTarget(null);
      load(statusFilter, offset);
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setReviewSaving(false);
    }
  };

  return (
    <>
      <h1 className="h3 mb-1">Мои записи</h1>
      <p className="text-muted mb-4">
        Здесь видны все ваши брони, статус листа ожидания и отзывы
      </p>

      <Nav variant="pills" className="mb-3 flex-wrap">
        {STATUS_TABS.map((t) => (
          <Nav.Link
            key={t.value}
            active={statusFilter === t.value}
            onClick={() => setStatusFilter(t.value)}
          >
            {t.label}
          </Nav.Link>
        ))}
      </Nav>

      {loading ? (
        <Loading text="Загружаем записи…" />
      ) : error ? (
        <ErrorAlert message={error} onRetry={() => load(statusFilter, offset)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bi-calendar-check"
          title="Записей пока нет"
          text="Найдите интересный мастер-класс в каталоге и запишитесь!"
          action={
            <Button as={Link} to="/" variant="primary">
              В каталог
            </Button>
          }
        />
      ) : (
        <>
          <ListGroup variant="flush" className="shadow-sm bg-white rounded border">
            {items.map((b) => {
              const w = b.workshop || {};
              const hoursLeft = hoursUntil(w.start_at);
              const canCancel =
                b.status === 'confirmed' &&
                hoursLeft > CANCEL_DEADLINE_HOURS;
              const canReview =
                b.status === 'confirmed' &&
                w.status === 'finished' &&
                !b.review_id;

              return (
                <ListGroup.Item key={b.id} className="py-3 px-3">
                  <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                    <div>
                      <Link to={`/workshops/${w.id}`} className="fw-bold fs-6">
                        {w.title}
                      </Link>
                      <div className="small text-muted mt-1">
                        <i className="bi bi-calendar-event me-1" />
                        {formatDateTime(w.start_at)}
                        <span className="mx-2">·</span>
                        <i className="bi bi-clock me-1" />
                        {formatDuration(w.duration_min)}
                        <span className="mx-2">·</span>
                        <i className="bi bi-person me-1" />
                        {personName(w.master)}
                      </div>
                      {w.location && (
                        <div className="small text-muted mt-1">
                          <i className="bi bi-geo-alt me-1" />
                          {w.location}
                        </div>
                      )}
                      <div className="small text-muted mt-1">
                        <i className="bi bi-ticket-perforated me-1" />
                        Бронь создана {formatDateTime(b.created_at)}
                      </div>
                    </div>

                    <div className="text-end">
                      <StatusBadge type="booking" value={b.status} />
                      <div className="mt-2 d-flex flex-column align-items-end gap-1">
                        {canCancel && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            onClick={() => setCancelTarget(b)}
                          >
                            Отменить
                          </Button>
                        )}
                        {b.status === 'confirmed' &&
                          !canCancel &&
                          hoursLeft > 0 &&
                          hoursLeft <= CANCEL_DEADLINE_HOURS && (
                            <span className="small text-muted" style={{ maxWidth: 200 }}>
                              Отмена недоступна: менее {CANCEL_DEADLINE_HOURS} ч до начала
                            </span>
                          )}
                        {canReview && (
                          <Button variant="outline-primary" size="sm" onClick={() => openReview(b)}>
                            Оставить отзыв
                          </Button>
                        )}
                        {b.review_id && (
                          <Badge bg="light" text="success" className="border">
                            <i className="bi bi-check2 me-1" />
                            Отзыв оставлен
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </ListGroup.Item>
              );
            })}
          </ListGroup>
          <p className="text-center text-muted small mt-2">Всего записей: {total}</p>
        </>
      )}

      {/* ---- Подтверждение отмены ---- */}
      <ConfirmModal
        show={!!cancelTarget}
        title="Отменить бронь?"
        body={
          cancelTarget && (
            <p className="mb-0">
              Вы отказываетесь от мастер-класса{' '}
              <b>«{cancelTarget.workshop?.title}»</b> ({formatDateTime(cancelTarget.workshop?.start_at)}).
              {cancelTarget.status === 'confirmed' && (
                <>
                  {' '}Освободившееся место автоматически получит первый участник из листа
                  ожидания.
                </>
              )}
            </p>
          )
        }
        confirmText="Отменить бронь"
        variant="danger"
        loading={cancelLoading}
        onConfirm={doCancel}
        onCancel={() => setCancelTarget(null)}
      />

      {/* ---- Окно отзыва ---- */}
      <Modal
        show={!!reviewTarget}
        onHide={() => setReviewTarget(null)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title className="fs-5">Оцените мастер-класс</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted small">
            {reviewTarget?.workshop?.title}
          </p>
          <Form.Group className="mb-3">
            <Form.Label className="d-block">Ваша оценка</Form.Label>
            <RatingInput
              value={reviewForm.rating}
              onChange={(rating) => setReviewForm((f) => ({ ...f, rating }))}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label>Комментарий (необязательно)</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              maxLength={2000}
              placeholder="Что понравилось? Что можно улучшить?"
              value={reviewForm.comment}
              onChange={(e) => setReviewForm((f) => ({ ...f, comment: e.target.value }))}
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setReviewTarget(null)}>
            Позже
          </Button>
          <Button variant="primary" onClick={submitReview} disabled={reviewSaving}>
            {reviewSaving ? 'Отправляем…' : 'Отправить отзыв'}
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
}
