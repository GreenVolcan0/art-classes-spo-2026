import { Container } from 'react-bootstrap';

export default function Footer() {
  return (
    <footer className="border-top py-4 bg-white">
      <Container className="text-center text-muted small">
        <div>
          <i className="bi bi-palette-fill text-primary me-1" />
          <b>АртКлассы</b> — бронирование творческих мастер-классов
        </div>
      </Container>
    </footer>
  );
}
