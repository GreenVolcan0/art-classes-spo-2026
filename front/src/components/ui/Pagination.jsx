import Pagination from 'react-bootstrap/Pagination';

/**
 * Пагинация под формат ответа бэкенда Page[T] = { items, total, limit, offset }.
 */
export default function PaginationBar({ total, limit, offset, onChange, className = '' }) {
  const pages = Math.max(1, Math.ceil((total || 0) / limit));
  const current = Math.floor((offset || 0) / limit) + 1;
  if (pages <= 1) return null;

  const nums = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - current) <= 2) nums.push(p);
  }

  const items = [];
  let last = 0;
  for (const p of nums) {
    if (p - last > 1) {
      items.push(<Pagination.Ellipsis key={`e${p}`} />);
    }
    items.push(
      <Pagination.Item key={p} active={p === current} onClick={() => onChange((p - 1) * limit)}>
        {p}
      </Pagination.Item>
    );
    last = p;
  }

  return (
    <Pagination className={`justify-content-center mt-4 mb-0 ${className}`}>
      <Pagination.Prev
        disabled={current === 1}
        onClick={() => onChange((current - 2) * limit)}
      />
      {items}
      <Pagination.Next
        disabled={current === pages}
        onClick={() => onChange(current * limit)}
      />
    </Pagination>
  );
}
