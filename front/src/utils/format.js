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

// ---------- Ввод дат в формате (дд.мм.гггг) ----------

/** Маска ввода даты: оставляет только цифры и сама расставляет точки (28.02.2026). */
export function maskRuDate(raw) {
  const digits = String(raw).replace(/\D/g, '').slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join('.');
}

/** Маска ввода времени в 24-часовом формате: чч:мм. */
export function maskRuTime(raw) {
  const digits = String(raw).replace(/\D/g, '').slice(0, 4);
  return [digits.slice(0, 2), digits.slice(2, 4)].filter(Boolean).join(':');
}

/** дд.мм.гггг — полная корректная дата (учитывается и число дней в месяце). */
export function isValidRuDate(text) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(text));
  if (!m) return false;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (mm < 1 || mm > 12) return false;
  const d = new Date(yyyy, mm - 1, dd);
  return d.getFullYear() === yyyy && d.getMonth() === mm - 1 && d.getDate() === dd;
}

/** Корректное время чч:мм (00:00–23:59). */
export function isValidRuTime(text) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(text));
}

/** дд.мм.гггг -> гггг-мм-дд (формат, который принимает API). */
export function ruDateToIso(text) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(text));
  return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}

/** гггг-мм-дд -> дд.мм.гггг (для предзаполнения полей при редактировании). */
export function isoDateToRu(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}
