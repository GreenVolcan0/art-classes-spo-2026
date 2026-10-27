import axios from 'axios';

// Базовый URL API: из переменной окружения VITE_API_BASE_URL
// либо относительный /api (проксируется Vite в dev и nginx в Docker).
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const TOKEN_KEY = 'ac_token';
const USER_KEY = 'ac_user';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Подставляем JWT-токен из localStorage в каждый запрос
client.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// При 401 (истёкший/невалидный токен) — разлогиниваем и отправляем на страницу входа.
// Логин и регистрацию не перехватываем: там 401 означает «неверные данные».
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    const isAuthRequest = url.includes('/auth/login') || url.includes('/auth/register');

    if (status === 401 && !isAuthRequest) {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      if (!window.location.pathname.startsWith('/login')) {
        window.location.assign('/login?expired=1');
      }
    }
    return Promise.reject(error);
  }
);

/**
 * Достаёт человекочитаемый текст ошибки из ответа FastAPI.
 * detail может быть строкой, массивом ошибок валидации или отсутствовать.
 */
export function getApiError(error) {
  const data = error?.response?.data;
  if (!data) {
    if (error?.code === 'ERR_NETWORK') {
      return 'Сервер недоступен. Проверьте, что бэкенд запущен.';
    }
    return error?.message || 'Произошла ошибка. Попробуйте ещё раз.';
  }
  if (typeof data.detail === 'string') return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail.map((d) => d.msg || JSON.stringify(d)).join('; ');
  }
  if (typeof data === 'string') return data;
  return 'Произошла ошибка. Попробуйте ещё раз.';
}

export { TOKEN_KEY, USER_KEY };
export default client;
