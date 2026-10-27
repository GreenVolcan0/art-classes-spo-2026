/**
 * Отображение рейтинга звёздами (только чтение).
 */
export default function RatingStars({ value = 0, className = '' }) {
  const rounded = Math.round(Number(value) || 0);
  return (
    <span className={`text-warning ${className}`} title={`${rounded} из 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={`bi ${n <= rounded ? 'bi-star-fill' : 'bi-star'} me-1`} />
      ))}
    </span>
  );
}
