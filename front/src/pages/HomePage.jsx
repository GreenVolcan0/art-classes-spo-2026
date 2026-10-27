import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row } from 'react-bootstrap';
import { useSearchParams } from 'react-router-dom';
import { categoriesApi, workshopsApi } from '../api/api';
import { getApiError } from '../api/client';
import WorkshopCard from '../components/workshop/WorkshopCard';
import ErrorAlert from '../components/ui/ErrorAlert';
import EmptyState from '../components/ui/EmptyState';
import Loading from '../components/ui/Loading';
import PaginationBar from '../components/ui/Pagination';
import { maskRuDate, isValidRuDate, ruDateToIso } from '../utils/format';

const PAGE_SIZE = 9;

const EMPTY_FILTERS = {
  q: '',
  category_id: '',
  master_id: '',
  price_min: '',
  price_max: '',
  date_from: '',
  date_to: '',
  only_available: false,
};

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const masterIdFromUrl = searchParams.get('master_id') || '';

  const [filters, setFilters] = useState(() => ({ ...EMPTY_FILTERS, master_id: masterIdFromUrl }));
  const [applied, setApplied] = useState(() => ({ ...EMPTY_FILTERS, master_id: masterIdFromUrl }));
  const [categories, setCategories] = useState([]);

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDateError, setShowDateError] = useState(false);

  // Список категорий для фильтра
  useEffect(() => {
    categoriesApi
      .list()
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const buildParams = useCallback((f, off) => {
    const params = { limit: PAGE_SIZE, offset: off };
    if (f.q) params.q = f.q.trim();
    if (f.category_id) params.category_id = Number(f.category_id);
    if (f.master_id) params.master_id = Number(f.master_id);
    if (f.price_min !== '') params.price_min = f.price_min;
    if (f.price_max !== '') params.price_max = f.price_max;
    if (f.date_from && isValidRuDate(f.date_from)) params.date_from = ruDateToIso(f.date_from);
    if (f.date_to && isValidRuDate(f.date_to)) params.date_to = ruDateToIso(f.date_to);
    if (f.only_available) params.only_available = true;
    return params;
  }, []);

  const load = useCallback(
    async (f, off) => {
      setLoading(true);
      setError('');
      try {
        const { data } = await workshopsApi.list(buildParams(f, off));
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

  // Первая загрузка и перезагрузка при смене применённых фильтров
  useEffect(() => {
    load(applied, 0);
    setOffset(0);
  }, [applied, load]);

  // Валидация дат фильтра — вводятся в российском формате дд.мм.гггг
  const dateFromOk = filters.date_from === '' || isValidRuDate(filters.date_from);
  const dateToOk = filters.date_to === '' || isValidRuDate(filters.date_to);
  const datesOrderOk =
    filters.date_from === '' ||
    filters.date_to === '' ||
    (isValidRuDate(filters.date_from) &&
      isValidRuDate(filters.date_to) &&
      ruDateToIso(filters.date_to) >= ruDateToIso(filters.date_from));
  const datesValid = dateFromOk && dateToOk && datesOrderOk;

  const apply = (e) => {
    e.preventDefault();
    if (!datesValid) {
      setShowDateError(true);
      return;
    }
    setShowDateError(false);
    setOffset(0);
    setApplied({ ...filters });
  };

  const reset = () => {
    setFilters({ ...EMPTY_FILTERS });
    setApplied({ ...EMPTY_FILTERS });
    setOffset(0);
    setShowDateError(false);
    setSearchParams({});
  };

  const changePage = (newOffset) => {
    setOffset(newOffset);
    load(applied, newOffset);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const clearMasterFilter = () => {
    setFilters((f) => ({ ...f, master_id: '' }));
    setApplied((f) => ({ ...f, master_id: '' }));
    setSearchParams({});
  };

  const setField = (name) => (e) =>
    setFilters((f) => ({
      ...f,
      [name]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
    }));

  return (
    <>
      <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2 mb-4">
        <div>
          <h1 className="h3 mb-1">Каталог мастер-классов</h1>
          <p className="text-muted mb-0">Творческие занятия от проверенных мастеров — выбирайте и записывайтесь</p>
        </div>
      </div>

      {masterIdFromUrl && (
        <Alert variant="info" className="d-flex justify-content-between align-items-center" dismissible onClose={clearMasterFilter}>
          <span>
            <i className="bi bi-person-badge me-2" />
            Показаны мастер-классы выбранного мастера
          </span>
        </Alert>
      )}

      <Row className="g-4">
        {/* ---- Фильтры ---- */}
        <Col lg={3}>
          <Card className="shadow-sm sticky-lg-top" style={{ top: '5.5rem' }}>
            <Card.Header className="bg-white">
              <i className="bi bi-funnel me-2 text-primary" />
              <b>Фильтры</b>
            </Card.Header>
            <Card.Body>
              <Form onSubmit={apply}>
                <Form.Group className="mb-3">
                  <Form.Label className="filter-label">Поиск</Form.Label>
                  <Form.Control
                    placeholder="Название или описание"
                    value={filters.q}
                    onChange={setField('q')}
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="filter-label">Категория</Form.Label>
                  <Form.Select value={filters.category_id} onChange={setField('category_id')}>
                    <option value="">Все категории</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="filter-label">Цена, ₽</Form.Label>
                  <Row className="g-2">
                    <Col>
                      <Form.Control
                        type="number"
                        min="0"
                        placeholder="от"
                        value={filters.price_min}
                        onChange={setField('price_min')}
                      />
                    </Col>
                    <Col>
                      <Form.Control
                        type="number"
                        min="0"
                        placeholder="до"
                        value={filters.price_max}
                        onChange={setField('price_max')}
                      />
                    </Col>
                  </Row>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label className="filter-label">Дата проведения</Form.Label>
                  <Row className="g-2">
                    <Col>
                      <Form.Control
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="дд.мм.гггг"
                        title="Дата с"
                        value={filters.date_from}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            date_from: maskRuDate(e.target.value),
                          }))
                        }
                        isInvalid={showDateError && !dateFromOk}
                      />
                    </Col>
                    <Col>
                      <Form.Control
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="дд.мм.гггг"
                        title="Дата по"
                        value={filters.date_to}
                        onChange={(e) =>
                          setFilters((f) => ({
                            ...f,
                            date_to: maskRuDate(e.target.value),
                          }))
                        }
                        isInvalid={showDateError && (!dateToOk || !datesOrderOk)}
                      />
                    </Col>
                  </Row>
                  {showDateError && !datesValid && (
                    <Form.Text className="text-danger">
                      {dateFromOk && dateToOk
                        ? 'Дата «по» не может быть раньше даты «с»'
                        : 'Введите дату в формате дд.мм.гггг'}
                    </Form.Text>
                  )}
                </Form.Group>

                <Form.Check
                  id="only-available"
                  type="checkbox"
                  className="mb-3"
                  label="Только со свободными местами"
                  checked={filters.only_available}
                  onChange={setField('only_available')}
                />

                <div className="d-grid gap-2">
                  <Button type="submit" variant="primary">
                    <i className="bi bi-search me-1" />
                    Применить
                  </Button>
                  <Button type="button" variant="outline-secondary" onClick={reset}>
                    Сбросить
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>

        {/* ---- Список ---- */}
        <Col lg={9}>
          {loading ? (
            <Loading text="Загружаем мастер-классы…" />
          ) : error ? (
            <ErrorAlert message={error} onRetry={() => load(applied, offset)} />
          ) : items.length === 0 ? (
            <EmptyState
              icon="bi-brush"
              title="Ничего не найдено"
              text="Попробуйте изменить фильтры или загляните позже — мастера регулярно публикуют новые мастер-классы."
              action={
                <Button variant="outline-primary" onClick={reset}>
                  Сбросить фильтры
                </Button>
              }
            />
          ) : (
            <>
              <Row xs={1} sm={2} xl={3} className="g-3">
                {items.map((w) => (
                  <Col key={w.id}>
                    <WorkshopCard workshop={w} />
                  </Col>
                ))}
              </Row>
              <PaginationBar total={total} limit={PAGE_SIZE} offset={offset} onChange={changePage} />
              <p className="text-center text-muted small mt-2">
                Показано {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} из {total}
              </p>
            </>
          )}
        </Col>
      </Row>
    </>
  );
}
