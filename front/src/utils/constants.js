// Справочники статусов и ролей: русские подписи и цвета бейджей Bootstrap.

export const WORKSHOP_STATUS = {
  draft: { label: 'Черновик', bg: 'secondary' },
  pending: { label: 'На модерации', bg: 'warning' },
  published: { label: 'Опубликован', bg: 'success' },
  rejected: { label: 'Отклонён', bg: 'danger' },
  cancelled: { label: 'Отменён', bg: 'dark' },
  finished: { label: 'Завершён', bg: 'info' },
};

export const BOOKING_STATUS = {
  confirmed: { label: 'Подтверждена', bg: 'success' },
  waitlisted: { label: 'Лист ожидания', bg: 'warning' },
  cancelled: { label: 'Отменена', bg: 'secondary' },
};

export const ROLE = {
  client: { label: 'Клиент', bg: 'info' },
  master: { label: 'Мастер', bg: 'primary' },
  admin: { label: 'Администратор', bg: 'dark' },
};

export const ENTITY_TYPE = {
  workshop: 'Мастер-класс',
  booking: 'Бронь',
  user: 'Пользователь',
  review: 'Отзыв',
  category: 'Категория',
};

export const ACTION = {
  created: { label: 'Создание', bg: 'success' },
  updated: { label: 'Изменение', bg: 'primary' },
  deleted: { label: 'Удаление', bg: 'danger' },
  approved: { label: 'Одобрение', bg: 'success' },
  rejected: { label: 'Отклонение', bg: 'danger' },
  cancelled: { label: 'Отмена', bg: 'secondary' },
};

/** Отменить подтверждённую бронь можно не позднее, чем за N часов до начала МК.
 *  Значение должно совпадать с CANCEL_DEADLINE_HOURS в бэкенде. */
export const CANCEL_DEADLINE_HOURS = 24;
