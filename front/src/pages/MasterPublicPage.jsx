import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, ListGroup, Row } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { mastersApi } from '../api/api';
import { getApiError } from '../api/client';
import ReviewsList from '../components/workshop/ReviewsList';
import ErrorAlert from '../components/ui/ErrorAlert';
import Loading from '../components/ui/Loading';
import RatingStars from '../components/ui/RatingStars';

export default function MasterPublicPage() {
  const { id } = useParams();
  const [master, setMaster] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [mRes, rRes] = await Promise.all([
        mastersApi.getOne(id),
        mastersApi.reviews(id, { limit: 100 }),
      ]);
      setMaster(mRes.data);
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

  if (loading) return <Loading text="Загружаем профиль мастера…" />;
  if (error) return <ErrorAlert message={error} onRetry={load} />;

  return (
    <>
      <h1 className="h3 mb-4">Профиль мастера</h1>

      <Row className="g-4">
        <Col md={4}>
          <Card className="shadow-sm text-center">
            <Card.Body>
              <i className="bi bi-person-circle display-3 text-primary" />
              <h5 className="mt-3 mb-1">
                {master.first_name} {master.last_name}
              </h5>

              {master.rating != null ? (
                <div className="mb-2">
                  <RatingStars value={master.rating} />
                  <div className="small text-muted">
                    {master.rating} · {master.reviews_count} отзывов
                  </div>
                </div>
              ) : (
                <div className="small text-muted mb-2">Рейтинг пока не сформирован</div>
              )}

              <ListGroup variant="flush" className="small text-start mt-3">
                {master.phone && (
                  <ListGroup.Item className="px-0 bg-transparent">
                    <i className="bi bi-telephone me-2 text-primary" />
                    {master.phone}
                  </ListGroup.Item>
                )}
              </ListGroup>

              {master.bio && <p className="text-muted small mt-3 mb-0">{master.bio}</p>}
            </Card.Body>
          </Card>
        </Col>

        <Col md={8}>
          <Card className="shadow-sm mb-4">
            <Card.Body className="d-flex flex-wrap justify-content-between align-items-center gap-2">
              <div>
                <b>
                  <i className="bi bi-brush me-2 text-primary" />
                  Мастер-классы этого мастера
                </b>
                <div className="small text-muted">
                  Посмотрите расписание и запишитесь на занятие
                </div>
              </div>
              <Button as={Link} to={`/?master_id=${master.id}`} variant="outline-primary">
                Смотреть каталог
              </Button>
            </Card.Body>
          </Card>

          <Card className="shadow-sm">
            <Card.Header className="bg-white">
              <i className="bi bi-chat-square-text me-2 text-primary" />
              <b>Отзывы о мастере</b>
            </Card.Header>
            <Card.Body>
              <ReviewsList
                reviews={reviews}
                emptyText="Отзывы появляются после посещения мастер-классов."
              />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
