import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { getApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export default function LoginPage() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const from = location.state?.from || '/';

  // Уже авторизованных отправляем дальше
  useEffect(() => {
    if (user) navigate(from, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email.trim(), password);
      toast('С возвращением!', 'success');
      navigate(from, { replace: true });
    } catch (err) {
      setError(getApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Row className="justify-content-center">
      <Col md={5} lg={4}>
        <Card className="shadow-sm">
          <Card.Body className="p-4">
            <div className="text-center mb-4">
              <i className="bi bi-palette-fill display-5 text-primary" />
              <h1 className="h4 mt-2 mb-1">Вход</h1>
              <p className="text-muted small mb-0">Рады видеть вас снова</p>
            </div>

            {searchParams.get('expired') && (
              <Alert variant="warning" className="small py-2">
                <i className="bi bi-clock-history me-1" />
                Сессия истекла. Войдите ещё раз.
              </Alert>
            )}

            {location.state?.registered === 'master' && (
              <Alert variant="info" className="small">
                Аккаунт мастера создан! Он будет доступен для публикации мастер-классов после
                одобрения администратором.
              </Alert>
            )}

            {location.state?.registered === 'client' && (
              <Alert variant="success" className="small">
                Регистрация успешна! Теперь войдите в аккаунт.
              </Alert>
            )}

            {error && (
              <Alert variant="danger" className="small py-2">
                <i className="bi bi-exclamation-triangle-fill me-1" />
                {error}
              </Alert>
            )}

            <Form onSubmit={submit}>
              <Form.Group className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>Пароль</Form.Label>
                <Form.Control
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="Ваш пароль"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Form.Group>

              <Button type="submit" variant="primary" className="w-100" disabled={loading}>
                {loading ? 'Входим…' : 'Войти'}
              </Button>
            </Form>

            <hr />
            <p className="text-center small text-muted mb-0">
              Нет аккаунта? <Link to="/register">Зарегистрируйтесь</Link>
            </p>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
