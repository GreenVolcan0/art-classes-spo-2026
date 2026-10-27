import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Form, Table } from 'react-bootstrap';
import { adminApi } from '../../api/api';
import { getApiError } from '../../api/client';
import EmptyState from '../../components/ui/EmptyState';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Loading from '../../components/ui/Loading';
import StatusBadge from '../../components/ui/StatusBadge';
import { ACTION, ENTITY_TYPE } from '../../utils/constants';
import { formatDateTime, personName } from '../../utils/format';

const INITIAL = { entity_type: '', action: '', user_id: '', entity_id: '' };

export default function AdminLogsPage() {
  const [filters, setFilters] = useState(INITIAL);
  const [applied, setApplied] = useState(INITIAL);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const buildParams = useCallback((f) => {
    const params = { limit: 50 };
    if (f.entity_type) params.entity_type = f.entity_type;
    if (f.action) params.action = f.action;
    if (f.user_id) params.user_id = Number(f.user_id);
    if (f.entity_id) params.entity_id = Number(f.entity_id);
    return params;
  }, []);

  const load = useCallback(
    async (f) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await adminApi.logs(buildParams(f));
        setItems(data.items ?? []);
        setTotal(data.total);
      } catch (e) {
        setError(getApiError(e));
      } finally {
        setLoading(false);
      }
    },
    [buildParams]
  );

  useEffect(() => {
    load(applied);
  }, [applied, load]);

  const submit = (e) => {
    e.preventDefault();
    setApplied({ ...filters });
  };

  const setField = (name) => (e) => setFilters((f) => ({ ...f, [name]: e.target.value }));

  return (
    <>
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <Form onSubmit={submit}>
            <div className="d-flex flex-wrap gap-2 align-items-end">
              <Form.Group style={{ width: 190 }}>
                <Form.Label className="filter-label">Сущность</Form.Label>
                <Form.Select size="sm" value={filters.entity_type} onChange={setField('entity_type')}>
                  <option value="">Все</option>
                  {Object.entries(ENTITY_TYPE).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group style={{ width: 170 }}>
                <Form.Label className="filter-label">Действие</Form.Label>
                <Form.Select size="sm" value={filters.action} onChange={setField('action')}>
                  <option value="">Все</option>
                  {Object.entries(ACTION).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>

              <Form.Group style={{ width: 130 }}>
                <Form.Label className="filter-label">ID пользователя</Form.Label>
                <Form.Control
                  size="sm"
                  type="number"
                  min="1"
                  placeholder="напр. 3"
                  value={filters.user_id}
                  onChange={setField('user_id')}
                />
              </Form.Group>

              <Form.Group style={{ width: 130 }}>
                <Form.Label className="filter-label">ID сущности</Form.Label>
                <Form.Control
                  size="sm"
                  type="number"
                  min="1"
                  placeholder="напр. 12"
                  value={filters.entity_id}
                  onChange={setField('entity_id')}
                />
              </Form.Group>

              <Button type="submit" variant="primary" size="sm" className="px-3">
                <i className="bi bi-search me-1" />
                Найти
              </Button>
              <Button
                variant="outline-secondary"
                size="sm"
                onClick={() => {
                  setFilters(INITIAL);
                  setApplied(INITIAL);
                }}
              >
                Сбросить
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      <div className="text-muted small mb-2">Записей: {total}</div>

      {loading ? (
        <Loading text="Загружаем журнал…" />
      ) : error ? (
        <ErrorAlert message={error} onRetry={() => load(applied)} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="bi-journal-text"
          title="Записей нет"
          text="Журнал наполняется автоматически при всех значимых действиях в системе."
        />
      ) : (
        <Card className="shadow-sm">
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Время</th>
                <th>Пользователь</th>
                <th>Действие</th>
                <th>Сущность</th>
                <th>Детали</th>
              </tr>
            </thead>
            <tbody>
              {items.map((log) => (
                <tr key={log.id}>
                  <td className="small text-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="small">
                    {log.user ? (
                      <>
                        {personName(log.user)}
                        <div className="text-muted">#{log.user.id}</div>
                      </>
                    ) : (
                      <span className="text-muted">Система</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge type="action" value={log.action} />
                  </td>
                  <td className="small text-nowrap">
                    {ENTITY_TYPE[log.entity_type] || log.entity_type}{' '}
                    <span className="text-muted">#{log.entity_id}</span>
                  </td>
                  <td className="small text-muted" style={{ maxWidth: 380 }}>
                    {log.details || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </>
  );
}
