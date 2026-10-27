import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, ListGroup, Row } from 'react-bootstrap';
import { usersApi } from '../api/api';
import { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/ui/StatusBadge';
import { formatDate } from '../utils/format';

export default function ProfilePage() {
  const { user, isMaster, isMasterApproved, updateStoredUser } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    phone: user?.phone || '',
    bio: user?.bio || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const { data } = await usersApi.updateMe({
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        phone: form.phone.trim() || null,
        ...(isMaster ? { bio: form.bio.trim() || null } : {}),
      });
      updateStoredUser(data);
      toast('Профиль обновлён', 'success');
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="h3 mb-4">Профиль</h1>

      <Row className="g-4">
        {/* ---- Информация об аккаунте ---- */}
        <Col md={4}>
          <Card className="shadow-sm">
            <Card.Body className="text-center">
              <i className="bi bi-person-circle display-3 text-primary" />
              <h5 className="mt-3 mb-1">
                {user.first_name} {user.last_name}
              </h5>
              <div className="mb-3">
                <StatusBadge type="role" value={user.role} />
              </div>

              <ListGroup variant="flush" className="small text-start">
                <ListGroup.Item className="px-0 bg-transparent">
                  <i className="bi bi-envelope me-2 text-primary" />
                  {user.email}
                </ListGroup.Item>
                {user.phone && (
                  <ListGroup.Item className="px-0 bg-transparent">
                    <i className="bi bi-telephone me-2 text-primary" />
                    {user.phone}
                  </ListGroup.Item>
                )}
                <ListGroup.Item className="px-0 bg-transparent">
                  <i className="bi bi-calendar3 me-2 text-primary" />
                  С нами с {formatDate(user.created_at)}
                </ListGroup.Item>
              </ListGroup>

              {isMaster && (
                <Alert
                  variant={isMasterApproved ? 'success' : 'warning'}
                  className="small mt-3 py-2 mb-0 text-start"
                >
                  <i className={`bi ${isMasterApproved ? 'bi-patch-check' : 'bi-hourglass-split'} me-1`} />
                  {isMasterApproved
                    ? 'Аккаунт одобрен администратором — можно публиковать мастер-классы.'
                    : 'Аккаунт ожидает одобрения администратора. Публиковать мастер-классы пока нельзя, но черновики создавать уже можно.'}
                </Alert>
              )}

              {!user.is_active && (
                <Alert variant="danger" className="small mt-3 py-2 mb-0">
                  Аккаунт заблокирован
                </Alert>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* ---- Редактирование ---- */}
        <Col md={8}>
          <Card className="shadow-sm">
            <Card.Header className="bg-white">
              <i className="bi bi-pencil-square me-2 text-primary" />
              <b>Редактирование данных</b>
            </Card.Header>
            <Card.Body>
              {error && (
                <Alert variant="danger" className="small py-2">
                  {error}
                </Alert>
              )}

              <Form onSubmit={submit}>
                <Row>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Имя</Form.Label>
                      <Form.Control
                        required
                        value={form.first_name}
                        onChange={setField('first_name')}
                      />
                    </Form.Group>
                  </Col>
                  <Col sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Фамилия</Form.Label>
                      <Form.Control
                        required
                        value={form.last_name}
                        onChange={setField('last_name')}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>Телефон</Form.Label>
                  <Form.Control
                    placeholder="+7 900 000-00-00"
                    value={form.phone || ''}
                    onChange={setField('phone')}
                  />
                </Form.Group>

                {isMaster && (
                  <Form.Group className="mb-3">
                    <Form.Label>
                      О себе <Badge bg="light" text="dark" className="border">видно клиентам</Badge>
                    </Form.Label>
                    <Form.Control
                      as="textarea"
                      rows={4}
                      placeholder="Опыт, образование, стиль преподавания…"
                      value={form.bio || ''}
                      onChange={setField('bio')}
                    />
                  </Form.Group>
                )}

                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Сохраняем…' : 'Сохранить изменения'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
