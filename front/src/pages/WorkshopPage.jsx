import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Col,
  ListGroup,
  ProgressBar,
  Row,
} from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { workshopsApi } from '../api/api';
import { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ReviewsList from '../components/workshop/ReviewsList';
import ConfirmModal from '../components/ui/ConfirmModal';
import ErrorAlert from '../components/ui/ErrorAlert';
import Loading from '../components/ui/Loading';
import StatusBadge from '../components/ui/StatusBadge';
import { formatDateTime, formatDuration, formatPrice, personName } from '../utils/format';

export default function WorkshopPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, isClient, isAdmin, isMaster } = useAuth();
  const toast = useToast();

  const [workshop, setWorkshop] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [booking, setBooking] = useState(false);
  const [cancelShow, setCancelShow] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [wRes, rRes] = await Promise.all([
        workshopsApi.getOne(id),
        workshopsApi.reviews(id, { limit: 100 }),
      ]);
      setWorkshop(wRes.data);
      setReviews(rRes.data.items ?? []);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const book = async (joinWaitlist) => {
    setBooking(true);
    try {
      const { data } = await workshopsApi.book(id, { join_waitlist: joinWaitlist });
      if (data.status === 'waitlisted') {
        toast('Свободных мест не было — вы добавлены в лист ожидания', 'warning');
      } else {
        toast('Вы успешно записаны на мастер-класс!', 'success');
      }
      load();
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setBooking(false);
    }
  };

  const cancelWorkshop = async () => {
    setCancelLoading(true);
    try {
      await workshopsApi.cancel(id);
      toast('Мастер-класс отменён, все активные брони аннулированы', 'warning');
      setCancelShow(false);
      load();
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setCancelLoading(false);
    }
  };

  if (loading) return <Loading text="Загружаем мастер-класс…" />;

  if (error) {
    return (
      <>
        <ErrorAlert message={error} onRetry={load} />
        <div className="text-center mt-3">
          <Button variant="outline-secondary" onClick={() => navigate('/')}>
            <i className="bi bi-arrow-left me-1" />
            В каталог
          </Button>
        </div>
      </>
    );
  }

  const w = workshop;
  const isOwner = isMaster && w.master?.id === user?.id;
  const canManage = isAdmin || isOwner;
  const isPast = w.start_at && new Date(w.start_at) < new Date();
  const bookedSeats = (w.capacity || 0) - (w.free_seats || 0);
  const bookedPct = w.capacity ? Math.round((bookedSeats / w.capacity) * 100) : 0;

  return (
    <>
      <Button variant="link" className="ps-0 mb-2 text-muted" onClick={() => navigate(-1)}>
        <i className="bi bi-arrow-left me-1" />
        Назад
      </Button>

      <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
        <h1 className="h3 mb-0 me-2">{w.title}</h1>
        <StatusBadge value={w.status} />
        {w.category && (
          <Badge bg="light" text="primary" className="border fw-normal">
            {w.category.name}
          </Badge>
        )}
      </div>

      <Row className="g-4 mt-1">
        {/* ---- Основная информация ---- */}
        <Col lg={8}>
          <Card className="shadow-sm mb-4">
            <Card.Body>
              <h5 className="mb-3">
                <i className="bi bi-card-text me-2 text-primary" />
                Описание
              </h5>
              <p className="mb-0" style={{ whiteSpace: 'pre-line' }}>
                {w.description}
              </p>
            </Card.Body>
          </Card>

          <Card className="shadow-sm">
            <Card.Header className="bg-white">
              <i className="bi bi-chat-square-text me-2 text-primary" />
              <b>Отзывы</b> <Badge bg="secondary">{reviews.length}</Badge>
            </Card.Header>
            <Card.Body>
              <ReviewsList
                reviews={reviews}
                emptyText="Этот мастер-класс ещё никто не оценил."
              />
            </Card.Body>
          </Card>
        </Col>

        {/* ---- Запись ---- */}
        <Col lg={4}>
          <Card className="shadow-sm mb-3">
            <Card.Body>
              <div className="h3 text-primary mb-0">{formatPrice(w.price)}</div>
              <div className="small text-muted mb-3">оплата производится на месте</div>

              <ListGroup variant="flush" className="small mb-3">
                <ListGroup.Item className="px-0 py-2 bg-transparent">
                  <i className="bi bi-calendar-event me-2 text-primary" />
                  {formatDateTime(w.start_at)}
                </ListGroup.Item>
                <ListGroup.Item className="px-0 py-2 bg-transparent">
                  <i className="bi bi-clock me-2 text-primary" />
                  Длительность: {formatDuration(w.duration_min)}
                </ListGroup.Item>
                <ListGroup.Item className="px-0 py-2 bg-transparent">
                  <i className="bi bi-geo-alt me-2 text-primary" />
                  {w.location}
                </ListGroup.Item>
                <ListGroup.Item className="px-0 py-2 bg-transparent">
                  <i className="bi bi-person me-2 text-primary" />
                  Мастер:{' '}
                  {w.master ? (
                    <Link to={`/masters/${w.master.id}`}>{personName(w.master)}</Link>
                  ) : (
                    '—'
                  )}
                </ListGroup.Item>
              </ListGroup>

              <div className="d-flex justify-content-between small text-muted mb-1">
                <span>
                  Занято: <b>{bookedSeats}</b> из {w.capacity}
                </span>
                <span>
                  Свободно: <b className={w.free_seats > 0 ? 'text-success' : 'text-danger'}>{w.free_seats}</b>
                </span>
              </div>
              <ProgressBar
                now={bookedPct}
                variant={w.free_seats > 0 ? 'primary' : 'danger'}
                className="mb-3"
                style={{ height: 8 }}
              />
              <hr />

              {/* --- Блок действий по роли --- */}
              {!user && (
                <div className="d-grid gap-2">
                  <Alert variant="light" className="small text-center py-2 mb-0">
                    Чтобы записаться, войдите в аккаунт
                  </Alert>
                  <Button as={Link} to="/login" state={{ from: `/workshops/${id}` }}>
                    Войти
                  </Button>
                  <Button as={Link} to="/register" variant="outline-primary">
                    Зарегистрироваться
                  </Button>
                </div>
              )}

              {user && isClient && (
                <>
                  {w.status !== 'published' ? (
                    <Alert variant="secondary" className="small text-center py-2 mb-0">
                      Запись на этот мастер-класс закрыта
                    </Alert>
                  ) : w.free_seats > 0 ? (
                    <Button
                      className="w-100"
                      size="lg"
                      onClick={() => book(false)}
                      disabled={booking || isPast}
                    >
                      <i className="bi bi-pencil-square me-2" />
                      Записаться
                    </Button>
                  ) : (
                    <div className="d-grid gap-2">
                      <Alert variant="warning" className="small text-center py-2 mb-0">
                        <i className="bi bi-hourglass-split me-1" />
                        Свободных мест нет
                      </Alert>
                      <Button
                        variant="outline-primary"
                        onClick={() => book(true)}
                        disabled={booking || isPast}
                      >
                        Записаться в лист ожидания
                      </Button>
                    </div>
                  )}
                  {isPast && (
                    <div className="small text-muted text-center mt-2">
                      Мастер-класс уже начался или прошёл
                    </div>
                  )}
                </>
              )}

              {user && canManage && (
                <div className="d-grid">
                  <Button
                    variant="outline-danger"
                    onClick={() => setCancelShow(true)}
                    disabled={w.status !== 'published'}
                  >
                    <i className="bi bi-x-octagon me-2" />
                    Отменить мастер-класс
                  </Button>
                  {w.status !== 'published' && (
                    <div className="small text-muted text-center mt-2">
                      Отменить можно только опубликованный МК
                    </div>
                  )}
                </div>
              )}

              {user && isMaster && !isOwner && !isAdmin && (
                <Alert variant="light" className="small text-center py-2 mb-0">
                  Запись доступна только клиентам
                </Alert>
              )}
            </Card.Body>
          </Card>

          {w.status === 'rejected' && canManage && w.reject_reason && (
            <Alert variant="danger" className="small">
              <b>Причина отклонения:</b>
              <div>{w.reject_reason}</div>
            </Alert>
          )}
        </Col>
      </Row>

      <ConfirmModal
        show={cancelShow}
        title="Отменить мастер-класс?"
        body={
          <>
            <p>
              Мастер-класс <b>«{w.title}»</b> будет отменён, а все активные брони — аннулированы.
              Это действие нельзя отменить.
            </p>
            <p className="small text-muted mb-0">
              Участников с подтверждёнными бронями: {bookedSeats}. В листе ожидания:{' '}
              {w.capacity - bookedSeats > 0 ? '—' : 'есть люди, которых стоит предупредить'}
            </p>
          </>
        }
        confirmText="Да, отменить"
        variant="danger"
        loading={cancelLoading}
        onConfirm={cancelWorkshop}
        onCancel={() => setCancelShow(false)}
      />
    </>
  );
}
