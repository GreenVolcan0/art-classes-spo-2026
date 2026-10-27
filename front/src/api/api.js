import client from './client';

// ============ Аутентификация ============
export const authApi = {
  login: (data) => client.post('/auth/login', data),
  register: (data) => client.post('/auth/register', data),
};

// ============ Пользователи ============
export const usersApi = {
  me: () => client.get('/users/me'),
  updateMe: (data) => client.patch('/users/me', data),
};

// ============ Категории ============
export const categoriesApi = {
  list: () => client.get('/categories'),
  create: (data) => client.post('/categories', data),
  update: (id, data) => client.patch(`/categories/${id}`, data),
  remove: (id) => client.delete(`/categories/${id}`),
};

// ============ Мастер-классы ============
export const workshopsApi = {
  /** Каталог с фильтрами: q, category_id, master_id, date_from, date_to, price_min, price_max, only_available, limit, offset */
  list: (params) => client.get('/workshops', { params }),
  getOne: (id) => client.get(`/workshops/${id}`),
  /** Мастер-классы текущего мастера: status, limit, offset */
  mine: (params) => client.get('/workshops/mine', { params }),
  create: (data) => client.post('/workshops', data),
  update: (id, data) => client.patch(`/workshops/${id}`, data),
  /** Отправка на модерацию: draft/rejected -> pending */
  submit: (id) => client.post(`/workshops/${id}/submit`),
  /** Отмена МК вместе со всеми активными бронями */
  cancel: (id) => client.post(`/workshops/${id}/cancel`),
  /** Участники и лист ожидания (для мастера и админа) */
  participants: (id) => client.get(`/workshops/${id}/participants`),
  reviews: (id, params) => client.get(`/workshops/${id}/reviews`, { params }),
  /** Запись клиента; { join_waitlist: true } — встать в лист ожидания */
  book: (id, data) => client.post(`/workshops/${id}/bookings`, data ?? {}),
};

// ============ Брони (клиент) ============
export const bookingsApi = {
  my: (params) => client.get('/bookings/my', { params }),
  cancel: (id) => client.post(`/bookings/${id}/cancel`),
  /** Отзыв по завершённой брони: { rating, comment } */
  review: (id, data) => client.post(`/bookings/${id}/review`, data),
};

// ============ Публичные профили мастеров ============
export const mastersApi = {
  getOne: (id) => client.get(`/masters/${id}`),
  reviews: (id, params) => client.get(`/masters/${id}/reviews`, { params }),
};

// ============ Админ-панель ============
export const adminApi = {
  users: (params) => client.get('/admin/users', { params }),
  approveMaster: (userId) => client.post(`/admin/masters/${userId}/approve`),
  blockUser: (userId) => client.post(`/admin/users/${userId}/block`),
  unblockUser: (userId) => client.post(`/admin/users/${userId}/unblock`),
  makeAdmin: (userId) => client.post(`/admin/users/${userId}/make-admin`),

  workshops: (params) => client.get('/admin/workshops', { params }),
  approveWorkshop: (id) => client.post(`/admin/workshops/${id}/approve`),
  rejectWorkshop: (id, reason) => client.post(`/admin/workshops/${id}/reject`, { reason }),

  reviews: (params) => client.get('/admin/reviews', { params }),
  hideReview: (id) => client.post(`/admin/reviews/${id}/hide`),
  unhideReview: (id) => client.post(`/admin/reviews/${id}/unhide`),

  logs: (params) => client.get('/admin/logs', { params }),
};
