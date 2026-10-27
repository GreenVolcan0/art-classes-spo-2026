import { Spinner } from 'react-bootstrap';

export default function Loading({ text = 'Загрузка…' }) {
  return (
    <div className="text-center py-5">
      <Spinner animation="border" variant="primary" />
      <div className="mt-2 text-muted small">{text}</div>
    </div>
  );
}
