# Backend — бронирование мастер-классов

Python 3.12 + FastAPI + SQLAlchemy 2.0 + PostgreSQL. Аутентификация: JWT + bcrypt. Роли: `client`, `master`, `admin`.

## Запуск

Из корня репозитория (нужен Docker):

```bash
docker compose up --build
```

- API: http://localhost:8000/api
- Swagger (интерактивная документация): http://localhost:8000/docs
- Первый администратор создаётся при старте, если админов в БД ещё нет:
  `admin@example.com` / `admin12345` (меняется через `FIRST_ADMIN_EMAIL` / `FIRST_ADMIN_PASSWORD`).

Локально без Docker:

```bash
cd back
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # поправьте DATABASE_URL
uvicorn app.main:app --reload
```

Таблицы создаются автоматически при старте (`Base.metadata.create_all`).

## Структура

```
back/
├── Dockerfile
├── requirements.txt
├── .env.example
└── app/
    ├── main.py          # приложение, CORS, подключение роутеров, фоновое завершение мастер-классов
    ├── config.py        # настройки из переменных окружения
    ├── database.py      # engine, сессия, Base
    ├── enums.py         # Role, WorkshopStatus, BookingStatus, EntityType, Action
    ├── models.py        # User, Category, Workshop, Booking, Review, ActionLog
    ├── schemas.py       # Pydantic-схемы запросов и ответов
    ├── security.py      # bcrypt, JWT
    ├── deps.py          # get_current_user, require_roles
    ├── init_db.py       # создание таблиц и первого администратора
    ├── routers/         # auth, users, masters, categories, workshops, bookings, admin
    └── services/        # audit (журнал), workshops (блокировки, лист ожидания, автозавершение)
```

## API (префикс `/api`)

| Метод и путь | Доступ | Что делает |
|---|---|---|
| `POST /auth/register` | все | регистрация (`role`: client или master) |
| `POST /auth/login` | все | вход, возвращает JWT и пользователя |
| `GET/PATCH /users/me` | авторизованные | свой профиль |
| `GET /masters/{id}`, `/masters/{id}/reviews` | все | профиль мастера с рейтингом, его отзывы |
| `GET /categories` | все | список категорий |
| `POST/PATCH/DELETE /categories[/{id}]` | admin | справочник категорий |
| `GET /workshops` | все | каталог + поиск и фильтры (`q`, `category_id`, `master_id`, `date_from`, `date_to`, `price_min`, `price_max`, `only_available`, `limit`, `offset`) |
| `GET /workshops/{id}` | все* | карточка (*черновик/на модерации/отклонён — только владельцу и админу) |
| `GET /workshops/{id}/reviews` | все | отзывы мастер-класса |
| `GET /workshops/mine` | master | мои мастер-классы во всех статусах |
| `POST /workshops` | master | создать черновик |
| `PATCH /workshops/{id}` | master (свой) | редактировать |
| `POST /workshops/{id}/submit` | master (свой, подтверждённый) | отправить на модерацию |
| `POST /workshops/{id}/cancel` | master (свой) / admin | отменить, все брони аннулируются |
| `GET /workshops/{id}/participants` | master (свой) / admin | участники и лист ожидания |
| `POST /workshops/{id}/bookings` | client | забронировать (`{"join_waitlist": true}` — встать в очередь, если мест нет) |
| `GET /bookings/my` | client | мои записи |
| `POST /bookings/{id}/cancel` | client | отменить бронь |
| `POST /bookings/{id}/review` | client | оставить отзыв и оценку 1–5 |
| `GET /admin/users` | admin | пользователи (фильтры `role`, `is_approved`, `is_active`, `q`) |
| `POST /admin/masters/{id}/approve` | admin | подтвердить мастера |
| `POST /admin/users/{id}/block`, `/unblock` | admin | блокировка и разблокировка |
| `POST /admin/users/{id}/make-admin` | admin | назначить администратора |
| `GET /admin/workshops?status=pending` | admin | очередь модерации |
| `POST /admin/workshops/{id}/approve`, `/reject` | admin | одобрить / отклонить (`{"reason": "..."}`) |
| `GET /admin/reviews`, `POST /admin/reviews/{id}/hide`, `/unhide` | admin | скрытие отзывов |
| `GET /admin/logs` | admin | журнал действий |

Списки возвращают `{items, total, limit, offset}`. Токен передаётся как `Authorization: Bearer <token>`.

## Как реализована бизнес-логика из аналитики

- **Защита от перебронирования.** Бронь создаётся в одной транзакции с `SELECT ... FOR UPDATE` по строке мастер-класса; плюс частичный уникальный индекс в БД на одну активную бронь клиента.
- **Лист ожидания.** Очередь по `created_at`. При отмене подтверждённой брони или увеличении числа мест первый из очереди переводится в `confirmed` в той же транзакции, действие пишется в журнал.
- **Отмена брони.** `confirmed` — не позднее чем за `CANCEL_DEADLINE_HOURS` (по умолчанию 24) до начала; `waitlisted` — в любой момент до начала.
- **Жизненный цикл.** `draft → pending → published | rejected`, `rejected → pending`, `published → cancelled | finished`. Переход в `finished` выполняется автоматически по времени (фоновая задача раз в минуту + проверка при запросах).
- **Редактирование.** При активных бронях нельзя менять дату, место и цену; места можно увеличить, но не ниже числа подтверждённых.
- **Отзывы и рейтинг.** Только по подтверждённой брони на `finished`, один на бронь; рейтинг — среднее по нескрытым отзывам.
- **Аудит.** Каждое значимое действие пишется в `ActionLog`. Физического удаления нет (кроме пустых категорий).
- **Блокировка.** `is_active` проверяется при каждом запросе, токены заблокированного пользователя перестают работать сразу.

## Принятые решения там, где аналитика неоднозначна

1. Мастер до подтверждения может создавать **черновики** (раздел 7), но не отправлять на модерацию. В матрице доступа написано «создание — после подтверждения»; выбран вариант из раздела 7.
2. Если мест нет, бронирование без `join_waitlist=true` возвращает `409` с кодом `no_free_seats` — клиент сначала соглашается на очередь.
3. Отмена мастер-класса возможна только из `published` (как в схеме переходов).
4. В `ActionLog.action` только значения из диаграммы классов; блокировка, скрытие отзыва и перевод из очереди пишутся как `updated` с пояснением в `details`.
5. Каталог показывает опубликованные мастер-классы, которые ещё не начались, у активных мастеров.

## Что не сделано

- Миграции Alembic (пока `create_all`), автотесты, уведомления и оплата (в аналитике это вне первой версии).
