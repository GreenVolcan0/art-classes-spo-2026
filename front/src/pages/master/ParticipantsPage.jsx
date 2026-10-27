import { useEffect, useState } from 'react';
import { Badge, Card, Col, ListGroup, Row, Table } from 'react-bootstrap';
import { Link, useParams } from 'react-router-dom';
import { workshopsApi } from '../../api/api';
import { getApiError } from '../../api/client';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Loading from '../../components/ui/Loading';
import { formatDateTime, personName } from '../../utils/format';

export default function ParticipantsPage() {
  const { id } = useParams();
  const [workshop, setWorkshop] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([workshopsApi.getOne(id), workshopsApi.participants(id)])
      .then(([wRes, pRes]) => {
        if (cancelled) return;
        setWorkshop(wRes.data);
        setData(pRes.data);
      })
      .catch((e) => !cancelled && setError(getApiError(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <Loading text="Загружаем списки участников…" />;
  if (error) return <ErrorAlert message={error} />;

  const confirmed = data.confirmed || [];
  const waitlist = data.waitlist || [];

  return (
    <>
      <Link to="/master/workshops" className="btn btn-link ps-0 mb-2 text-muted">
        <i className="bi bi-arrow-left me-1" />
        К списку
      </Link>

      <h1 className="h3 mb-1">Участники</h1>
      {workshop && (
        <p className="text-muted mb-4">
          «{workshop.title}» · {formatDateTime(workshop.start_at)}
        </p>
      )}

      <Row className="g-4">
        <Col md={7}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
              <b>
                <i className="bi bi-people-fill me-2 text-success" />
                Подтверждённые
              </b>
              <Badge bg="success">{confirmed.length}</Badge>
            </Card.Header>
            <Card.Body className="p-0">
              {confirmed.length === 0 ? (
                <p className="text-muted text-center py-5 mb-0">Пока никто не записался</p>
              ) : (
                <Table responsive hover className="align-middle mb-0">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Участник</th>
                      <th>Телефон</th>
                    </tr>
                  </thead>
                  <tbody>
                    {confirmed.map((p, i) => (
                      <tr key={p.id ?? i}>
                        <td className="text-muted">{i + 1}</td>
                        <td>
                          <i className="bi bi-person me-2 text-primary" />
                          {personName(p)}
                        </td>
                        <td className="small text-muted">{p.phone || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </Card.Body>
          </Card>
        </Col>

        <Col md={5}>
          <Card className="shadow-sm h-100">
            <Card.Header className="bg-white d-flex justify-content-between align-items-center">
              <b>
                <i className="bi bi-hourglass-split me-2 text-warning" />
                Лист ожидания
              </b>
              <Badge bg="warning" text="dark">
                {waitlist.length}
              </Badge>
            </Card.Header>
            <Card.Body className="p-0">
              {waitlist.length === 0 ? (
                <p className="text-muted text-center py-5 mb-0">Лист ожидания пуст</p>
              ) : (
                <ListGroup variant="flush">
                  {waitlist.map((p, i) => (
                    <ListGroup.Item key={p.id ?? i} className="d-flex align-items-center gap-3">
                      <Badge bg="light" text="dark" className="border">
                        {i + 1}
                      </Badge>
                      <div>
                        <div>{personName(p)}</div>
                        <div className="small text-muted">{p.phone || 'телефон не указан'}</div>
                      </div>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              )}
            </Card.Body>
          </Card>
          <p className="text-muted small mt-2 mb-0">
            <i className="bi bi-info-circle me-1" />
            При отмене подтверждённой брони первый в очереди автоматически получает место.
          </p>
        </Col>
      </Row>
    </>
  );
}
