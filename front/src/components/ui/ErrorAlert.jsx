import { Alert, Button } from 'react-bootstrap';

export default function ErrorAlert({ message, onRetry }) {
  if (!message) return null;
  return (
    <Alert variant="danger" className="d-flex flex-wrap justify-content-between align-items-center gap-2">
      <span>
        <i className="bi bi-exclamation-triangle-fill me-2" />
        {message}
      </span>
      {onRetry && (
        <Button variant="outline-danger" size="sm" onClick={onRetry}>
          <i className="bi bi-arrow-clockwise me-1" />
          Повторить
        </Button>
      )}
    </Alert>
  );
}
