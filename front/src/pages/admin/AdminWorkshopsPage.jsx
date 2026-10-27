import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Form, Modal, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { adminApi, workshopsApi } from '../../api/api';
import { getApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import EmptyState from '../../components/ui/EmptyState';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Loading from '../../components/ui/Loading';
import StatusBadge from '../../components/ui/StatusBadge';
import { WORKSHOP_STATUS } from '../../utils/constants';
import { formatDateTime, formatPrice, personName } from '../../utils/format';

export default function AdminWorkshopsPage() {
  const toast = useToast();

  const [statusFilter, setStatusFilter] = useState('pending');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [approveTarget, setApproveTarget] = useState(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectError, setRejectError] = useState('');
  const [rejectLoading, setRejectLoading] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const load = useCallback(async (status) => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 50 };
      if (status) params.status_filter = status;
      const { data } = await adminApi.workshops(params);
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

  const doApprove = async () => {
    if (!approveTarget) return;
    setApproveLoading(true);
    try {
      await adminApi.approveWorkshop(approveTarget.id);
      toast('Мастер-класс опубликован', 'success');
      setApproveTarget(null);
      load(statusFilter);
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setApproveLoading(false);
    }
  };

  const doReject = async () => {
    if (!rejectTarget) return;
    if (!rejectReason.trim()) {
      setRejectError('Укажите причину отклонения — мастер увидит её в кабинете');
      return;
    }
    setRejectLoading(true);
    try {
      await adminApi.rejectWorkshop(rejectTarget.id, rejectReason.trim());
      toast('Мастер-класс отклонён', 'warning');
      setRejectTarget(null);
      load(statusFilter);
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setRejectLoading(false);
    }
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      await workshopsApi.cancel(cancelTarget.id);
      toast('Мастер-класс отменён', 'warning');
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
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <b>Мастер-классы</b>
          <span className="text-muted small ms-2">Всего: {total}</span>
        </div>
        <Form.Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ width: 240 }}
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
        <Loading text="Загружаем мастер-классы…" />
      ) : error ? (
        <ErrorAlert message={error} onRetry={() => load(statusFilter)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bi-easel2"
          title="Ничего не найдено"
          text="В этом статусе мастер-классов нет. Новые заявки на модерации появятся здесь."
        />
      ) : (
        <Card className="shadow-sm">
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Мастер-класс</th>
                <th>Мастер</th>
                <th>Дата</th>
                <th>Цена</th>
                <th>Статус</th>
                <th className="text-end">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id}>
                  <td>
                    <Link to={`/workshops/${w.id}`} className="fw-semibold">
                      {w.title}
                    </Link>
                    {w.category && <div className="small text-muted">{w.category.name}</div>}
                  </td>
                  <td className="small">{personName(w.master)}</td>
                  <td className="small">{formatDateTime(w.start_at)}</td>
                  <td className="small">{formatPrice(w.price)}</td>
                  <td>
                    <StatusBadge value={w.status} />
                  </td>
                  <td className="text-end">
                    <div className="d-flex gap-1 justify-content-end flex-wrap">
                      {w.status === 'pending' && (
                        <>
                          <Button
                            variant="outline-success"
                            size="sm"
                            title="Одобрить"
                            onClick={() => setApproveTarget(w)}
                          >
                            <i className="bi bi-check-lg" />
                          </Button>
                          <Button
                            variant="outline-danger"
                            size="sm"
                            title="Отклонить"
                            onClick={() => {
                              setRejectTarget(w);
                              setRejectReason('');
                              setRejectError('');
                            }}
                          >
                            <i className="bi bi-x-lg" />
                          </Button>
                        </>
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
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <ConfirmModal
        show={!!approveTarget}
        title="Одобрить мастер-класс?"
        body={
          approveTarget && (
            <p className="mb-0">
              <b>«{approveTarget.title}»</b> будет опубликован в каталоге и станет доступен для
              записи.
            </p>
          )
        }
        confirmText="Одобрить и опубликовать"
        variant="success"
        loading={approveLoading}
        onConfirm={doApprove}
        onCancel={() => setApproveTarget(null)}
      />

      {/* Отклонение с обязательной причиной */}
      <Modal
        show={!!rejectTarget}
        onHide={() => setRejectTarget(null)}
        centered
        backdrop="static"
      >
        <Modal.Header closeButton>
          <Modal.Title className="fs-5">Отклонить мастер-класс</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>
            <b>«{rejectTarget?.title}»</b> не будет опубликован. Мастер увидит причину и сможет
            исправить МК.
          </p>
          {rejectError && (
            <Alert variant="danger" className="small py-2">
              {rejectError}
            </Alert>
          )}
          <Form.Control
            as="textarea"
            rows={3}
            maxLength={2000}
            placeholder="Например: описание не соответствует программе, уточните состав материалов"
            value={rejectReason}
            onChange={(e) => {
              setRejectReason(e.target.value);
              setRejectError('');
            }}
          />
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setRejectTarget(null)}>
            Назад
          </Button>
          <Button variant="danger" onClick={doReject} disabled={rejectLoading}>
            {rejectLoading ? 'Отправляем…' : 'Отклонить'}
          </Button>
        </Modal.Footer>
      </Modal>

      <ConfirmModal
        show={!!cancelTarget}
        title="Отменить мастер-класс?"
        body={
          cancelTarget && (
            <p className="mb-0">
              <b>«{cancelTarget.title}»</b> будет отменён, все активные брони — аннулированы.
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
