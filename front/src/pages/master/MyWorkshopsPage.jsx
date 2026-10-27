import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { workshopsApi } from '../../api/api';
import { getApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import EmptyState from '../../components/ui/EmptyState';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Loading from '../../components/ui/Loading';
import StatusBadge from '../../components/ui/StatusBadge';
import { WORKSHOP_STATUS } from '../../utils/constants';
import { formatDateTime, formatPrice } from '../../utils/format';

export default function MyWorkshopsPage() {
  const { isMasterApproved } = useAuth();
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [submitTarget, setSubmitTarget] = useState(null);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async (status) => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 50 };
      if (status) params.status = status;
      const { data } = await workshopsApi.mine(params);
      setItems(data.items ?? []);
      setTotal(data.total);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(statusFilter);
  }, [statusFilter, load]);

  const doSubmit = async () => {
    if (!submitTarget) return;
    setSubmitLoading(true);
    try {
      await workshopsApi.submit(submitTarget.id);
      toast('Мастер-класс отправлен на модерацию', 'success');
      setSubmitTarget(null);
      load(statusFilter);
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setSubmitLoading(false);
    }
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await workshopsApi.cancel(cancelTarget.id);
      toast('Мастер-класс отменён, брони аннулированы', 'warning');
      setCancelTarget(null);
      load(statusFilter);
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
        <div>
          <h1 className="h3 mb-1">Мои мастер-классы</h1>
          <p className="text-muted mb-0">Управляйте расписанием и следите за модерацией</p>
        </div>
        <Button as={Link} to="/master/workshops/new" variant="primary">
          <i className="bi bi-plus-lg me-1" />
          Создать мастер-класс
        </Button>
      </div>

      {!isMasterApproved && (
        <Alert variant="warning" className="approval-banner">
          <i className="bi bi-hourglass-split me-2" />
          <b>Аккаунт ожидает одобрения администратора.</b> Вы можете создавать черновики, но
          отправить мастер-класс на публикацию получится после одобрения.
        </Alert>
      )}

      <div className="d-flex align-items-center gap-2 mb-3">
        <Form.Label className="mb-0 text-muted small">Статус:</Form.Label>
        <Form.Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 220 }}
          size="sm"
        >
          <option value="">Все статусы</option>
          {Object.entries(WORKSHOP_STATUS).map(([key, cfg]) => (
            <option key={key} value={key}>
              {cfg.label}
            </option>
          ))}
        </Form.Select>
      </div>

      {loading ? (
        <Loading text="Загружаем список…" />
      ) : error ? (
        <ErrorAlert message={error} onRetry={() => load(statusFilter)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bi-easel2"
          title="Мастер-классов пока нет"
          text="Создайте первый мастер-класс: заполните форму, сохраните черновик и отправьте на модерацию."
          action={
            <Button as={Link} to="/master/workshops/new" variant="primary">
              <i className="bi bi-plus-lg me-1" />
              Создать мастер-класс
            </Button>
          }
        />
      ) : (
        <Card className="shadow-sm">
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Мастер-класс</th>
                <th>Дата</th>
                <th>Цена</th>
                <th>Места</th>
                <th>Статус</th>
                <th className="text-end">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => {
                const editable = ['draft', 'rejected'].includes(w.status);
                return (
                  <tr key={w.id}>
                    <td>
                      <Link to={`/workshops/${w.id}`} className="fw-semibold">
                        {w.title}
                      </Link>
                      {w.category && (
                        <div className="small text-muted">{w.category.name}</div>
                      )}
                      {w.status === 'rejected' && w.reject_reason && (
                        <div className="small text-danger mt-1">
                          <i className="bi bi-exclamation-circle me-1" />
                          Причина: {w.reject_reason}
                        </div>
                      )}
                    </td>
                    <td className="small">{formatDateTime(w.start_at)}</td>
                    <td className="small">{formatPrice(w.price)}</td>
                    <td className="small">
                      {w.free_seats} / {w.capacity}
                    </td>
                    <td>
                      <StatusBadge value={w.status} />
                    </td>
                    <td className="text-end">
                      <div className="d-flex gap-1 justify-content-end flex-wrap">
                        {editable && (
                          <Button
                            as={Link}
                            to={`/master/workshops/${w.id}/edit`}
                            variant="outline-secondary"
                            size="sm"
                            title="Редактировать"
                          >
                            <i className="bi bi-pencil" />
                          </Button>
                        )}
                        {editable && (
                          <Button
                            variant="outline-primary"
                            size="sm"
                            title="Отправить на модерацию"
                            onClick={() => setSubmitTarget(w)}
                          >
                            <i className="bi bi-send" />
                          </Button>
                        )}
                        {['published', 'finished'].includes(w.status) && (
                          <Button
                            as={Link}
                            to={`/master/workshops/${w.id}/participants`}
                            variant="outline-info"
                            size="sm"
                            title="Участники"
                          >
                            <i className="bi bi-people" />
                          </Button>
                        )}
                        {w.status === 'published' && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            title="Отменить МК"
                            onClick={() => setCancelTarget(w)}
                          >
                            <i className="bi bi-x-octagon" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Card>
      )}

      <p className="text-muted small mt-2 mb-0">
        <i className="bi bi-info-circle me-1" />
        Жизненный цикл: черновик → на модерации → опубликован → завершён. Отклонённый МК можно
        исправить и отправить снова.
      </p>

      <ConfirmModal
        show={!!submitTarget}
        title="Отправить на модерацию?"
        body={
          submitTarget && (
            <p className="mb-0">
              Мастер-класс <b>«{submitTarget.title}»</b> будет отправлен администратору на
              проверку. После одобрения он появится в каталоге.
            </p>
          )
        }
        confirmText="Отправить"
        loading={submitLoading}
        onConfirm={doSubmit}
        onCancel={() => setSubmitTarget(null)}
      />

      <ConfirmModal
        show={!!cancelTarget}
        title="Отменить мастер-класс?"
        body={
          cancelTarget && (
            <p className="mb-0">
              Мастер-класс <b>«{cancelTarget.title}»</b> будет отменён, все активные брони —
              аннулированы. Действие необратимо.
            </p>
          )
        }
        confirmText="Да, отменить"
        variant="danger"
        loading={cancelLoading}
        onConfirm={doCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </>
  );
}
