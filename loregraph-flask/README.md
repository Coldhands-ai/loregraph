# LoreGraph — Flask edition

Конструктор интерактивных вики с графом связей. Без TypeScript, без сторонних BaaS — Python + PostgreSQL у себя.

## Стек

- **Backend**: Flask 3 + SQLAlchemy 2 + Flask-Login + Flask-WTF
- **Database**: PostgreSQL 17 (в Docker)
- **Auth**: email/password (bcrypt) + Google OAuth (Authlib)
- **Frontend**: Jinja2 + Tailwind CSS (через CDN) + Alpine.js (микро-реактивность) + HTMX (плавные переходы без SPA)
- **Editor**: EasyMDE — Markdown с тулбаром и сплит-вью
- **Graph**: Cytoscape.js — force-layout без React

## Быстрый старт

### 1. Поднять Postgres
```powershell
cd loregraph-flask
docker compose up -d
```
Проверить, что встал: `docker compose ps` → статус `healthy`.

### 2. Создать виртуальное окружение и поставить зависимости
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 3. Создать `.env`
```powershell
Copy-Item .env.example .env
```
Открыть `.env`, проставить `FLASK_SECRET_KEY` (любая длинная случайная строка). `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — опционально, без них OAuth-кнопка просто будет отсутствовать.

### 4. Запустить
```powershell
flask --app app run --debug
```
Открыть http://127.0.0.1:5000.

При первом запуске схема БД создаётся автоматически (`db.create_all()`).

## Google OAuth (опционально)

В Google Cloud Console у того OAuth-клиента, который ты создал для Supabase-варианта, в **Authorized redirect URIs** добавить:
```
http://127.0.0.1:5000/auth/google/callback
```
Client ID и Secret положить в `.env` — те же самые, что были в Supabase.

## Структура

```
loregraph-flask/
├── app.py                # точка входа, фабрика приложения
├── config.py             # конфигурация из env
├── extensions.py         # db, login_manager, oauth, csrf
├── models.py             # SQLAlchemy: User, World, Category, Article, Relation
├── forms.py              # WTForms: формы логина, регистрации, создания мира и т.д.
├── routes/
│   ├── auth.py           # /auth/login, /register, /logout, /google
│   ├── worlds.py         # /worlds — список и создание миров
│   ├── articles.py       # /worlds/<id>/articles — список, редактор, автосейв
│   └── graph.py          # /worlds/<id>/graph — страница графа + JSON-эндпоинт
├── templates/            # Jinja2-шаблоны
├── static/
│   ├── css/styles.css    # точечные стили (всё остальное — Tailwind через CDN)
│   └── js/               # editor.js (EasyMDE + autosave), graph.js (Cytoscape)
├── docker-compose.yml    # Postgres
├── requirements.txt
├── .env.example
└── README.md
```

## Как это устроено

- **SSR** (server-side rendering): Flask отдаёт готовый HTML, JS добавляется точечно (граф, редактор, модалки)
- **Plain Markdown** хранится в `articles.content_md` как обычный текст; рендерится в HTML через `markdown` + санитизацию `bleach`
- **Граф** строится из таблиц `articles` (узлы) и `relations` (рёбра). Бэкенд отдаёт JSON по `/worlds/<id>/graph/data`, фронт рендерит через Cytoscape с force-layout
- **Автосейв** в редакторе: debounce 2 сек на клиенте → POST `/articles/<id>/autosave` с Markdown → 200 OK
- **Защита** маршрутов через `@login_required`. Доступ к данным (мирам, статьям) проверяется владельцем (`World.user_id == current_user.id`) на уровне запросов — простой проверкой в каждой view

## Полезное

```powershell
# Остановить Postgres
docker compose down

# Полностью сбросить БД (вместе с данными!)
docker compose down -v

# Подключиться к БД через psql
docker exec -it loregraph_pg psql -U loregraph -d loregraph
```
