import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { Link, useNavigate } from 'react-router-dom';
import { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const INITIAL = {
  role: 'client',
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  password: '',
  password2: '',
  bio: '',
};

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const validate = () => {
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'Укажите имя';
    if (!form.last_name.trim()) errs.last_name = 'Укажите фамилию';
    if (!form.email.trim()) errs.email = 'Укажите email';
    if (!form.password) errs.password = 'Придумайте пароль';
    else if (form.password.length < 8) errs.password = 'Минимум 8 символов';
    if (form.password2 !== form.password) errs.password2 = 'Пароли не совпадают';
    if (form.role === 'master' && !form.bio.trim()) errs.bio = 'Расскажите о себе — это увидят клиенты';
    return errs;
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const payload = {
        role: form.role,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
        phone: form.phone.trim() || null,
        bio: form.role === 'master' ? form.bio.trim() || null : null,
      };
      await register(payload);
      toast('Регистрация успешна!', 'success');
      navigate('/login', { state: { registered: form.role }, replace: true });
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row className="justify-content-center">
      <Col md={8} lg={7} xl={6}>
        <Card className="shadow-sm">
          <Card.Body className="p-4">
            <div className="text-center mb-4">
              <i className="bi bi-person-plus-fill display-5 text-primary" />
              <h1 className="h4 mt-2 mb-1">Регистрация</h1>
              <p className="text-muted small mb-0">
                Клиент записывается на мастер-классы, мастер — проводит их
              </p>
            </div>

            {error && (
              <Alert variant="danger" className="small py-2">
                <i className="bi bi-exclamation-triangle-fill me-1" />
                {error}
              </Alert>
            )}

            <Form onSubmit={submit} noValidate>
              <Form.Group className="mb-3">
                <Form.Label>Кто вы?</Form.Label>
                <div>
                  <Form.Check
                    inline
                    type="radio"
                    label="Клиент — хочу записываться на занятия"
                    name="role"
                    id="role-client"
                    value="client"
                    checked={form.role === 'client'}
                    onChange={setField('role')}
                  />
                  <Form.Check
                    inline
                    type="radio"
                    label="Мастер — хочу проводить мастер-классы"
                    name="role"
                    id="role-master"
                    value="master"
                    checked={form.role === 'master'}
                    onChange={setField('role')}
                  />
                </div>
              </Form.Group>

              <Row>
                <Col sm={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Имя</Form.Label>
                    <Form.Control
                      required
                      placeholder="Анна"
                      value={form.first_name}
                      onChange={setField('first_name')}
                      isInvalid={!!errors.first_name}
                    />
                    <Form.Control.Feedback type="invalid">{errors.first_name}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col sm={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Фамилия</Form.Label>
                    <Form.Control
                      required
                      placeholder="Смирнова"
                      value={form.last_name}
                      onChange={setField('last_name')}
                      isInvalid={!!errors.last_name}
                    />
                    <Form.Control.Feedback type="invalid">{errors.last_name}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col sm={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Email</Form.Label>
                    <Form.Control
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      value={form.email}
                      onChange={setField('email')}
                      isInvalid={!!errors.email}
                    />
                    <Form.Control.Feedback type="invalid">{errors.email}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col sm={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Телефон (необязательно)</Form.Label>
                    <Form.Control
                      placeholder="+7 900 000-00-00"
                      value={form.phone}
                      onChange={setField('phone')}
                    />
                  </Form.Group>
                </Col>
              </Row>

              <Row>
                <Col sm={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Пароль</Form.Label>
                    <Form.Control
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="Минимум 8 символов"
                      value={form.password}
                      onChange={setField('password')}
                      isInvalid={!!errors.password}
                    />
                    <Form.Control.Feedback type="invalid">{errors.password}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col sm={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Повторите пароль</Form.Label>
                    <Form.Control
                      type="password"
                      required
                      autoComplete="new-password"
                      placeholder="Ещё раз"
                      value={form.password2}
                      onChange={setField('password2')}
                      isInvalid={!!errors.password2}
                    />
                    <Form.Control.Feedback type="invalid">{errors.password2}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              {form.role === 'master' && (
                <Form.Group className="mb-3">
                  <Form.Label>О себе</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Расскажите о своём опыте: образование, стиль, чем хотите делиться"
                    value={form.bio}
                    onChange={setField('bio')}
                    isInvalid={!!errors.bio}
                  />
                  <Form.Text muted>
                    Этот текст увидят клиенты в вашем публичном профиле.
                  </Form.Text>
                  <Form.Control.Feedback type="invalid">{errors.bio}</Form.Control.Feedback>
                </Form.Group>
              )}

              {form.role === 'master' && (
                <Alert variant="info" className="small">
                  <i className="bi bi-info-circle me-1" />
                  Аккаунт мастера активируется после одобрения администратором — это часть
                  процесса модерации каталога.
                </Alert>
              )}

              <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                {loading ? 'Регистрируем…' : 'Создать аккаунт'}
              </Button>
            </Form>

            <hr />
            <p className="text-center small text-muted mb-0">
              Уже есть аккаунт? <Link to="/login">Войдите</Link>
            </p>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
