// Форматирование дат, цен и длительностей на русском языке (без внешних библиотек).

export function formatDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

export function formatPrice(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export function formatDuration(min) {
  const m = Number(min);
  if (!m || Number.isNaN(m)) return '—';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} ч ${rest} мин` : `${h} ч`;
}

/** ISO-строку -> значение для <input type="datetime-local"> в локальном времени. */
export function toLocalInput(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Сколько часов осталось до начала (может быть отрицательным, если МК уже прошёл). */
export function hoursUntil(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return (d.getTime() - Date.now()) / 3_600_000;
}

export function personName(person) {
  if (!person) return '—';
  return [person.first_name, person.last_name].filter(Boolean).join(' ') || '—';
}
