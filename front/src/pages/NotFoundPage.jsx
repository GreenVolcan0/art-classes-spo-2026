import { Button } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import EmptyState from '../components/ui/EmptyState';

export default function NotFoundPage() {
  return (
    <EmptyState
      icon="bi-compass"
      title="Страница не найдена"
      text="Похоже, вы забрели не туда. Вернитесь в каталог мастер-классов."
      action={
        <Button as={Link} to="/" variant="primary">
          <i className="bi bi-house me-1" />
          На главную
        </Button>
      }
    />
  );
}
