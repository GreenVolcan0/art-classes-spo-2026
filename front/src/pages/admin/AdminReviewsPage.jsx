import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/api';
import { getApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import EmptyState from '../../components/ui/EmptyState';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Loading from '../../components/ui/Loading';
import RatingStars from '../../components/ui/RatingStars';
import { formatDate, personName } from '../../utils/format';

export default function AdminReviewsPage() {
  const toast = useToast();

  const [hiddenFilter, setHiddenFilter] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [target, setTarget] = useState(null); // { review, action: 'hide'|'unhide' }
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async (hidden) => {
    setLoading(true);
    setError('');
    try {
      const params = { limit: 50 };
      if (hidden) params.is_hidden = hidden === 'yes';
      const { data } = await adminApi.reviews(params);
      setItems(data.items ?? []);
      setTotal(data.total);
    } catch (e) {
      setError(getApiError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(hiddenFilter);
  }, [hiddenFilter, load]);

  const runAction = async () => {
    if (!target) return;
    setActionLoading(true);
    try {
      if (target.action === 'hide') await adminApi.hideReview(target.review.id);
      else await adminApi.unhideReview(target.review.id);
      toast(target.action === 'hide' ? 'Отзыв скрыт' : 'Отзыв снова виден', 'success');
      setTarget(null);
      load(hiddenFilter);
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <div>
          <b>Отзывы</b>
          <span className="text-muted small ms-2">Всего: {total}</span>
        </div>
        <Form.Select
          value={hiddenFilter}
          onChange={(e) => setHiddenFilter(e.target.value)}
          style={{ width: 240 }}
          size="sm"
        >
          <option value="">Все отзывы</option>
          <option value="no">Только видимые</option>
          <option value="yes">Только скрытые</option>
        </Form.Select>
      </div>

      {loading ? (
        <Loading text="Загружаем отзывы…" />
      ) : error ? (
        <ErrorAlert message={error} onRetry={() => load(hiddenFilter)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bi-chat-square-text"
          title="Отзывов нет"
          text="Отзывы появятся, когда клиенты начнут посещать мастер-классы."
        />
      ) : (
        <Card className="shadow-sm">
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Мастер-класс</th>
                <th>Клиент</th>
                <th>Оценка</th>
                <th>Комментарий</th>
                <th>Дата</th>
                <th className="text-end">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id} className={r.is_hidden ? 'opacity-75' : ''}>
                  <td>
                    <Link to={`/workshops/${r.workshop_id}`} className="fw-semibold small">
                      МК #{r.workshop_id}
                    </Link>
                  </td>
                  <td className="small">{personName(r.client)}</td>
                  <td>
                    <RatingStars value={r.rating} />
                  </td>
                  <td className="small" style={{ maxWidth: 320 }}>
                    {r.comment || <span className="text-muted">—</span>}
                  </td>
                  <td className="small text-muted">{formatDate(r.created_at)}</td>
                  <td className="text-end">
                    {r.is_hidden ? (
                      <Button
                        variant="outline-success"
                        size="sm"
                        title="Вернуть в каталог"
                        onClick={() => setTarget({ review: r, action: 'unhide' })}
                      >
                        <i className="bi bi-eye" />
                      </Button>
                    ) : (
                      <Button
                        variant="outline-warning"
                        size="sm"
                        title="Скрыть отзыв"
                        onClick={() => setTarget({ review: r, action: 'hide' })}
                      >
                        <i className="bi bi-eye-slash" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      <ConfirmModal
        show={!!target}
        title={target?.action === 'hide' ? 'Скрыть отзыв?' : 'Сделать отзыв видимым?'}
        body={
          target ? (
            <p className="mb-0">
              {target.action === 'hide'
                ? 'Отзыв перестанет отображаться в каталоге и профиле мастера, но сохранится в системе.'
                : 'Отзыв снова появится в каталоге и профиле мастера.'}
            </p>
          ) : null
        }
        confirmText={target?.action === 'hide' ? 'Скрыть' : 'Показать'}
        variant={target?.action === 'hide' ? 'warning' : 'success'}
        loading={actionLoading}
        onConfirm={runAction}
        onCancel={() => setTarget(null)}
      />
    </>
  );
}
