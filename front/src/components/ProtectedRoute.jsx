import { Alert } from 'react-bootstrap';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Loading from './ui/Loading';

/**
 * Защита маршрутов.
 * roles — список допустимых ролей; если не задан, достаточно факта авторизации.
 */
export default function ProtectedRoute({ roles, children }) {
  const { user, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return <Loading text="Проверяем авторизацию…" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <Alert variant="warning" className="text-center mt-4">
        <i className="bi bi-shield-lock me-2" />
        У вашей роли нет доступа к этому разделу.
      </Alert>
    );
  }

  return children;
}
