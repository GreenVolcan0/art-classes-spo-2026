import { useState } from 'react';

/**
 * Интерактивный выбор оценки (1–5 звёзд).
 */
export default function RatingInput({ value, onChange }) {
  return (
    <div className="d-inline-flex align-items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className="btn btn-link p-0 fs-3 lh-1"
          style={{ textDecoration: 'none' }}
          onClick={() => onChange(n)}
          title={`Оценка ${n}`}
        >
          <i className={`bi ${n <= value ? 'bi-star-fill text-warning' : 'bi-star text-muted'}`} />
        </button>
      ))}
      {value > 0 && <span className="ms-2 text-muted small">{value} из 5</span>}
    </div>
  );
}
