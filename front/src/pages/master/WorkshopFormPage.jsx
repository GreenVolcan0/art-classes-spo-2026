import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { categoriesApi, workshopsApi } from '../../api/api';
import { getApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import ErrorAlert from '../../components/ui/ErrorAlert';
import Loading from '../../components/ui/Loading';
import { toLocalInput } from '../../utils/format';

const INITIAL = {
  category_id: '',
  title: '',
  description: '',
  location: '',
  start_at: '',
  duration_min: '60',
  price: '',
  capacity: '10',
};

export default function WorkshopFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(INITIAL);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notOwner, setNotOwner] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Категории для селекта
  useEffect(() => {
    categoriesApi
      .list()
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  // При редактировании — загружаем МК и проверяем владельца
  useEffect(() => {
    if (!isEdit) return;
    let cancelled = false;
    setLoading(true);
    workshopsApi
      .getOne(id)
      .then((res) => {
        if (cancelled) return;
        const w = res.data;
        if (w.master?.id !== user?.id) {
          setNotOwner(true);
        } else {
          setForm({
            category_id: w.category ? String(w.category.id) : '',
            title: w.title || '',
            description: w.description || '',
            location: w.location || '',
            start_at: toLocalInput(w.start_at),
            duration_min: String(w.duration_min ?? ''),
            price: w.price != null ? String(w.price) : '',
            capacity: String(w.capacity ?? ''),
          });
          setRejectReason(w.reject_reason || '');
        }
      })
      .catch((e) => !cancelled && setError(getApiError(e)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const setField = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  const validate = useMemo(
    () => () => {
      const errs = {};
      if (!form.category_id) errs.category_id = 'Выберите категорию';
      if (!form.title.trim() || form.title.trim().length < 3)
        errs.title = 'Название — минимум 3 символа';
      else if (form.title.trim().length > 200) errs.title = 'Максимум 200 символов';
      if (!form.description.trim()) errs.description = 'Опишите мастер-класс';
      if (!form.location.trim()) errs.location = 'Укажите место проведения';
      if (!form.start_at) errs.start_at = 'Укажите дату и время';
      const dur = Number(form.duration_min);
      if (!dur || dur < 1 || dur > 1440) errs.duration_min = 'От 1 до 1440 минут';
      const price = Number(form.price);
      if (form.price === '' || Number.isNaN(price) || price < 0) errs.price = 'Цена — число от 0';
      const cap = Number(form.capacity);
      if (!cap || cap < 1 || cap > 1000) errs.capacity = 'От 1 до 1000 участников';
      return errs;
    },
    [form]
  );

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const payload = {
      category_id: Number(form.category_id),
      title: form.title.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      start_at: form.start_at,
      duration_min: Number(form.duration_min),
      price: String(form.price),
      capacity: Number(form.capacity),
    };

    setSaving(true);
    try {
      if (isEdit) {
        await workshopsApi.update(id, payload);
        toast('Изменения сохранены', 'success');
      } else {
        await workshopsApi.create(payload);
        toast('Черновик создан. Теперь его можно отправить на модерацию!', 'success');
      }
      navigate('/master/workshops');
    } catch (err) {
      setError(getApiError(err));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Loading text="Загружаем форму…" />;

  if (notOwner) {
    return (
      <Alert variant="warning" className="text-center mt-4">
        <i className="bi bi-shield-lock me-2" />
        Это не ваш мастер-класс — редактирование недоступно.
        <div className="mt-3">
          <Button as={Link} to="/master/workshops" variant="outline-primary" size="sm">
            К списку моих мастер-классов
          </Button>
        </div>
      </Alert>
    );
  }

  return (
    <Row className="justify-content-center">
      <Col lg={8}>
        <Button as={Link} to="/master/workshops" variant="link" className="ps-0 mb-2 text-muted">
          <i className="bi bi-arrow-left me-1" />
          К списку
        </Button>

        <h1 className="h3 mb-1">{isEdit ? 'Редактирование мастер-класса' : 'Новый мастер-класс'}</h1>
        <p className="text-muted mb-4">
          {isEdit
            ? 'Внесите изменения и сохраните. Статус МК при редактировании не меняется.'
            : 'Заполните информацию — сначала создастся черновик, затем отправьте его на модерацию.'}
        </p>

        {isEdit && rejectReason && (
          <Alert variant="danger" className="small">
            <b>Мастер-класс был отклонён модератором.</b> Причина: {rejectReason}
            <div className="mt-1">Исправьте недочёты и отправьте на модерацию повторно.</div>
          </Alert>
        )}

        {error && <ErrorAlert message={error} />}

        <Card className="shadow-sm">
          <Card.Body className="p-4">
            <Form onSubmit={submit} noValidate>
              <Form.Group className="mb-3">
                <Form.Label>Название *</Form.Label>
                <Form.Control
                  required
                  placeholder="Например: Роспись шёлкового платка"
                  value={form.title}
                  onChange={setField('title')}
                  isInvalid={!!errors.title}
                  maxLength={200}
                />
                <Form.Control.Feedback type="invalid">{errors.title}</Form.Control.Feedback>
              </Form.Group>

              <Row>
                <Col sm={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Категория *</Form.Label>
                    <Form.Select
                      value={form.category_id}
                      onChange={setField('category_id')}
                      isInvalid={!!errors.category_id}
                    >
                      <option value="">Выберите категорию…</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">
                      {errors.category_id}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col sm={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>Место проведения *</Form.Label>
                    <Form.Control
                      required
                      placeholder="Студия «Палитра», ул. Ленина, 10"
                      value={form.location}
                      onChange={setField('location')}
                      isInvalid={!!errors.location}
                    />
                    <Form.Control.Feedback type="invalid">{errors.location}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              <Form.Group className="mb-3">
                <Form.Label>Описание *</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={5}
                  required
                  placeholder="Что будет на занятии, для кого оно, что унесут с собой участники…"
                  value={form.description}
                  onChange={setField('description')}
                  isInvalid={!!errors.description}
                />
                <Form.Control.Feedback type="invalid">
                  {errors.description}
                </Form.Control.Feedback>
              </Form.Group>

              <Row>
                <Col sm={6} md={4}>
                  <Form.Group className="mb-3">
                    <Form.Label>Дата и время *</Form.Label>
                    <Form.Control
                      type="datetime-local"
                      required
                      value={form.start_at}
                      onChange={setField('start_at')}
                      isInvalid={!!errors.start_at}
                    />
                    <Form.Control.Feedback type="invalid">{errors.start_at}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col sm={6} md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Длительность, мин *</Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      max="1440"
                      required
                      value={form.duration_min}
                      onChange={setField('duration_min')}
                      isInvalid={!!errors.duration_min}
                    />
                    <Form.Text muted>от 1 до 1440</Form.Text>
                    <Form.Control.Feedback type="invalid">
                      {errors.duration_min}
                    </Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col sm={6} md={2}>
                  <Form.Group className="mb-3">
                    <Form.Label>Цена, ₽ *</Form.Label>
                    <Form.Control
                      type="number"
                      min="0"
                      step="0.01"
                      required
                      value={form.price}
                      onChange={setField('price')}
                      isInvalid={!!errors.price}
                    />
                    <Form.Control.Feedback type="invalid">{errors.price}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
                <Col sm={6} md={3}>
                  <Form.Group className="mb-3">
                    <Form.Label>Мест *</Form.Label>
                    <Form.Control
                      type="number"
                      min="1"
                      max="1000"
                      required
                      value={form.capacity}
                      onChange={setField('capacity')}
                      isInvalid={!!errors.capacity}
                    />
                    <Form.Text muted>от 1 до 1000</Form.Text>
                    <Form.Control.Feedback type="invalid">{errors.capacity}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
              </Row>

              <hr />
              <div className="d-flex gap-2">
                <Button type="submit" variant="primary" disabled={saving}>
                  {saving ? 'Сохраняем…' : isEdit ? 'Сохранить изменения' : 'Создать черновик'}
                </Button>
                <Button
                  as={Link}
                  to="/master/workshops"
                  variant="outline-secondary"
                  disabled={saving}
                >
                  Отмена
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </Col>
    </Row>
  );
}
