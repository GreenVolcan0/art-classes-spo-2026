import { Container, Nav, NavDropdown, Navbar as BsNavbar } from 'react-bootstrap';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, isClient, isMaster, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <BsNavbar expand="lg" bg="white" variant="light" sticky="top" className="border-bottom shadow-sm">
      <Container>
        <BsNavbar.Brand as={Link} to="/" className="fw-bold">
          <i className="bi bi-palette-fill text-primary me-2" />
          <span className="text-body">Арт</span>
          <span className="text-primary">Классы</span>
        </BsNavbar.Brand>

        <BsNavbar.Toggle aria-controls="main-nav" />
        <BsNavbar.Collapse id="main-nav">
          <Nav className="me-auto">
            <Nav.Link as={NavLink} to="/" end>
              Каталог
            </Nav.Link>
            {isClient && <Nav.Link as={NavLink} to="/my-bookings">Мои записи</Nav.Link>}
            {isMaster && <Nav.Link as={NavLink} to="/master/workshops">Мои мастер-классы</Nav.Link>}
            {isAdmin && <Nav.Link as={NavLink} to="/admin">Админ-панель</Nav.Link>}
          </Nav>

          <Nav>
            {!user ? (
              <>
                <Nav.Link as={NavLink} to="/login">
                  <i className="bi bi-box-arrow-in-right me-1" />
                  Войти
                </Nav.Link>
                <Nav.Link
                  as={NavLink}
                  to="/register"
                  className="btn btn-primary text-white px-3 ms-lg-2 mt-2 mt-lg-0"
                >
                  Регистрация
                </Nav.Link>
              </>
            ) : (
              <NavDropdown
                id="user-dropdown"
                align="end"
                title={
                  <>
                    <i className="bi bi-person-circle me-1" />
                    {user.first_name}
                  </>
                }
              >
                <NavDropdown.Item as={Link} to="/profile">
                  <i className="bi bi-person me-2" />
                  Профиль
                </NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2" />
                  Выйти
                </NavDropdown.Item>
              </NavDropdown>
            )}
          </Nav>
        </BsNavbar.Collapse>
      </Container>
    </BsNavbar>
  );
}
