import { Col, Nav, Row } from 'react-bootstrap';
import { NavLink, Outlet } from 'react-router-dom';

const TABS = [
  { to: '/admin/workshops', icon: 'bi-easel2', label: 'Модерация МК' },
  { to: '/admin/users', icon: 'bi-people', label: 'Пользователи' },
  { to: '/admin/reviews', icon: 'bi-chat-square-text', label: 'Отзывы' },
  { to: '/admin/categories', icon: 'bi-tags', label: 'Категории' },
  { to: '/admin/logs', icon: 'bi-journal-text', label: 'Журнал действий' },
];

export default function AdminLayout() {
  return (
    <>
      <h1 className="h3 mb-1">Админ-панель</h1>
      <p className="text-muted mb-4">Модерация каталога и управление системой</p>

      <Row>
        <Col md={3} lg={2} className="mb-4">
          <Nav variant="pills" className="flex-column gap-1">
            {TABS.map((t) => (
              <Nav.Link key={t.to} as={NavLink} to={t.to}>
                <i className={`bi ${t.icon} me-2`} />
                {t.label}
              </Nav.Link>
            ))}
          </Nav>
        </Col>
        <Col md={9} lg={10}>
          <Outlet />
        </Col>
      </Row>
    </>
  );
}
