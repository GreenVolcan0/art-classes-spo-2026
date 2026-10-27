import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, InputGroup, Row, Table } from 'react-bootstrap';
import { adminApi } from '../../api/api';
import { getApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ConfirmModal from '../../components/ui/ConfirmModal';
import EmptyState from '../../components/ui/EmptyState';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Loading from '../../components/ui/Loading';
import StatusBadge from '../../components/ui/StatusBadge';
import { ROLE } from '../../utils/constants';
import { formatDate, personName } from '../../utils/format';

export default function AdminUsersPage() {
  const toast = useToast();
  const { user: me } = useAuth();

  const [filters, setFilters] = useState({ q: '', role: '', is_approved: '', is_active: '' });
  const [applied, setApplied] = useState({ q: '', role: '', is_approved: '', is_active: '' });

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // { type: 'approve'|'block'|'unblock'|'makeAdmin', user }
  const [confirmAction, setConfirmAction] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  const buildParams = useCallback((f) => {
    const params = { limit: 50 };
    if (f.q) params.q = f.q.trim();
    if (f.role) params.role = f.role;
    if (f.is_approved) params.is_approved = f.is_approved === 'yes';
    if (f.is_active) params.is_active = f.is_active === 'yes';
    return params;
  }, []);

  const load = useCallback(
    async (f) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await adminApi.users(buildParams(f));
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

  const apply = (e) => {
    e.preventDefault();
    setApplied({ ...filters });
  };

  const setField = (name) => (e) => setFilters((f) => ({ ...f, [name]: e.target.value }));

  const runAction = async () => {
    if (!confirmAction) return;
    const { type, user } = confirmAction;
    setActionLoading(true);
    try {
      if (type === 'approve') await adminApi.approveMaster(user.id);
      else if (type === 'block') await adminApi.blockUser(user.id);
      else if (type === 'unblock') await adminApi.unblockUser(user.id);
      else if (type === 'makeAdmin') await adminApi.makeAdmin(user.id);
      toast('Готово', 'success');
      setConfirmAction(null);
      load(applied);
    } catch (e) {
      toast(getApiError(e), 'danger');
    } finally {
      setActionLoading(false);
    }
  };

  const ACTION_META = {
    approve: {
      title: 'Одобрить мастера?',
      body: (u) => (
        <>
          <b>{personName(u)}</b> получит возможность публиковать мастер-классы в каталоге.
        </>
      ),
      confirmText: 'Одобрить',
      variant: 'success',
    },
    block: {
      title: 'Заблокировать пользователя?',
      body: (u) => (
        <>
          <b>{personName(u)}</b> не сможет входить в систему. Профиль и данные сохранятся.
        </>
      ),
      confirmText: 'Заблокировать',
      variant: 'danger',
    },
    unblock: {
      title: 'Разблокировать пользователя?',
      body: (u) => (
        <>
          Доступ для <b>{personName(u)}</b> будет восстановлен.
        </>
      ),
      confirmText: 'Разблокировать',
      variant: 'success',
    },
    makeAdmin: {
      title: 'Назначить администратором?',
      body: (u) => (
        <>
          <b>{personName(u)}</b> получит полный доступ к модерации, пользователям и журналу.
          Отозвать роль через интерфейс нельзя!
        </>
      ),
      confirmText: 'Назначить',
      variant: 'danger',
    },
  };

  return (
    <>
      <Card className="shadow-sm mb-4">
        <Card.Body>
          <Form onSubmit={apply}>
            <Row className="g-2 align-items-end">
              <Col md={4}>
                <Form.Label className="filter-label">Поиск</Form.Label>
                <InputGroup>
                  <Form.Control
                    placeholder="Имя или email"
                    value={filters.q}
                    onChange={setField('q')}
                  />
                  <Button variant="outline-primary" type="submit">
                    <i className="bi bi-search" />
                  </Button>
                </InputGroup>
              </Col>
              <Col md={2} sm={4}>
                <Form.Label className="filter-label">Роль</Form.Label>
                <Form.Select value={filters.role} onChange={setField('role')}>
                  <option value="">Все</option>
                  {Object.entries(ROLE).map(([key, cfg]) => (
                    <option key={key} value={key}>
                      {cfg.label}
                    </option>
                  ))}
                </Form.Select>
              </Col>
              <Col md={2} sm={4}>
                <Form.Label className="filter-label">Одобрен</Form.Label>
                <Form.Select value={filters.is_approved} onChange={setField('is_approved')}>
                  <option value="">Все</option>
                  <option value="yes">Да</option>
                  <option value="no">Нет</option>
                </Form.Select>
              </Col>
              <Col md={2} sm={4}>
                <Form.Label className="filter-label">Статус</Form.Label>
                <Form.Select value={filters.is_active} onChange={setField('is_active')}>
                  <option value="">Все</option>
                  <option value="yes">Активен</option>
                  <option value="no">Заблокирован</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Button
                  variant="outline-secondary"
                  className="w-100"
                  onClick={() => {
                    const empty = { q: '', role: '', is_approved: '', is_active: '' };
                    setFilters(empty);
                    setApplied(empty);
                  }}
                >
                  Сбросить
                </Button>
              </Col>
            </Row>
          </Form>
        </Card.Body>
      </Card>

      <div className="text-muted small mb-2">Всего пользователей: {total}</div>

      {loading ? (
        <Loading text="Загружаем пользователей…" />
      ) : error ? (
        <ErrorAlert message={error} onRetry={() => load(applied)} />
      ) : items.length === 0 ? (
        <EmptyState icon="bi-people" title="Пользователи не найдены" text="Измените параметры поиска." />
      ) : (
        <Card className="shadow-sm">
          <Table responsive hover className="align-middle mb-0">
            <thead>
              <tr>
                <th>Пользователь</th>
                <th>Роль</th>
                <th>Одобрен</th>
                <th>Статус</th>
                <th>Регистрация</th>
                <th className="text-end">Действия</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => {
                const isSelf = u.id === me?.id;
                return (
                  <tr key={u.id}>
                    <td>
                      <div className="fw-semibold">{personName(u)}</div>
                      <div className="small text-muted">{u.email}</div>
                      {u.phone && <div className="small text-muted">{u.phone}</div>}
                    </td>
                    <td>
                      <StatusBadge type="role" value={u.role} />
                    </td>
                    <td>
                      {u.is_approved ? (
                        <i className="bi bi-check-circle-fill text-success" title="Одобрен" />
                      ) : (
                        <i className="bi bi-x-circle text-muted" title="Не одобрен" />
                      )}
                    </td>
                    <td>
                      {u.is_active ? (
                        <span className="text-success small">Активен</span>
                      ) : (
                        <span className="text-danger small">Заблокирован</span>
                      )}
                    </td>
                    <td className="small text-muted">{formatDate(u.created_at)}</td>
                    <td className="text-end">
                      <div className="d-flex gap-1 justify-content-end flex-wrap">
                        {u.role === 'master' && !u.is_approved && (
                          <Button
                            variant="outline-success"
                            size="sm"
                            title="Одобрить мастера"
                            onClick={() => setConfirmAction({ type: 'approve', user: u })}
                          >
                            <i className="bi bi-patch-check" />
                          </Button>
                        )}
                        {!isSelf && u.is_active && (
                          <Button
                            variant="outline-danger"
                            size="sm"
                            title="Заблокировать"
                            onClick={() => setConfirmAction({ type: 'block', user: u })}
                          >
                            <i className="bi bi-slash-circle" />
                          </Button>
                        )}
                        {!isSelf && !u.is_active && (
                          <Button
                            variant="outline-success"
                            size="sm"
                            title="Разблокировать"
                            onClick={() => setConfirmAction({ type: 'unblock', user: u })}
                          >
                            <i className="bi bi-arrow-counterclockwise" />
                          </Button>
                        )}
                        {!isSelf && u.role !== 'admin' && u.is_active && (
                          <Button
                            variant="outline-dark"
                            size="sm"
                            title="Сделать администратором"
                            onClick={() => setConfirmAction({ type: 'makeAdmin', user: u })}
                          >
                            <i className="bi bi-shield-plus" />
                          </Button>
                        )}
                        {isSelf && (
                          <span className="small text-muted align-self-center">это вы</span>
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

      <Alert variant="light" className="small mt-3 text-muted">
        <i className="bi bi-info-circle me-1" />
        Блокировка запрещает вход в систему, но сохраняет все данные пользователя. Категорию
        «одобрение» проходят только мастера — клиенты публикуют записи без модерации аккаунта.
      </Alert>

      <ConfirmModal
        show={!!confirmAction}
        title={confirmAction ? ACTION_META[confirmAction.type].title : ''}
        body={
          confirmAction &&
          ACTION_META[confirmAction.type].body(confirmAction.user)
        }
        confirmText={confirmAction ? ACTION_META[confirmAction.type].confirmText : ''}
        variant={confirmAction ? ACTION_META[confirmAction.type].variant : 'primary'}
        loading={actionLoading}
        onConfirm={runAction}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
