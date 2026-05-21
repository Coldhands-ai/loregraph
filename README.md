# LoreGraph

**LoreGraph** — учебное веб-приложение для создания персональных вики с интерактивным графом связей.

Пользователь создаёт миры, наполняет их статьями о персонажах, локациях, событиях, предметах и фракциях, задаёт именованные связи между статьями и просматривает структуру мира как граф.

Проект реализован как Flask-приложение в каталоге [`loregraph-flask`](loregraph-flask).

## Возможности

- Регистрация и вход по email/паролю + опциональный Google OAuth.
- Личный список миров с обложкой и пресетами сеттингов (Default, Fantasy, DarkFantasy, Sci-Fi, Cyberpunk, Steampunk, Wasteland, Custom) — у каждого своя палитра, шрифт и тематические декорации.
- Автоматическое создание 5 категорий, привязанных к выбранному сеттингу. Управление категориями: название, цвет, вес узла на графе, поля шаблона (`template_fields`).
- Каталог статей с поиском, фильтром по категориям и закреплёнными материалами.
- Редактор статьи (Toast UI Editor — Markdown/WYSIWYG): автосохранение с дебаунсом 2 секунды, кастомные поля категории, обложка, теги.
- История версий: 3 авто-слота (rolling по таймеру) + 2 ручных (не перетираются), восстановление с safety-net снапшотом.
- Закладки — кросс-мировые, на отдельной странице.
- Полнотекстовый поиск через Postgres FTS (`tsvector` + GIN, префиксный матч): глобальный по всем своим мирам и локальный внутри мира.
- Кроппер изображений (Cropper.js на клиенте + Pillow на сервере): аватары 512×512, обложки статей 1280×720, обложки миров 1500×500. EXIF-rotation, защита от path traversal и RAM-бомб.
- Именованные направленные связи между статьями с автокомплитом.
- Интерактивный граф на Cytoscape.js: цвет и размер узлов по категории, фильтры, поиск, клик → переход к статье.
- Профиль пользователя: имя, аватар, смена пароля.
- Админ-панель с пагинацией: статистика, пользователи (блок/анблок, выдача/снятие admin-прав), миры (просмотр, удаление), append-only журнал действий.

## Стек

**Backend:** Python 3.13, Flask 3, SQLAlchemy 2, Flask-Login, Flask-WTF, Flask-Migrate, Authlib, bcrypt, Pillow, waitress (production WSGI).

**Database:** PostgreSQL 17 в Docker, миграции через Alembic/Flask-Migrate.

**Frontend:** Jinja2 SSR, Tailwind CSS (локальная сборка через standalone CLI), Alpine.js, Toast UI Editor, Cytoscape.js, Cropper.js.

Проект не использует фронтенд-сборщик и `node_modules`: страницы рендерятся на сервере, а JavaScript подключается точечно для редактора, графа, кроппера и автокомплита.

## Быстрый старт

```powershell
cd loregraph-flask

# 1. Поднять PostgreSQL
docker compose up -d

# 2. Создать виртуальное окружение и установить зависимости
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

# 3. Создать .env
Copy-Item .env.example .env

# 4. Применить миграции и запустить приложение
flask --app app db upgrade
flask --app app run --debug
```

Открой `.env` и проставь `FLASK_SECRET_KEY` (любая длинная случайная строка). Остальное можно оставить как в `.env.example`.

После запуска приложение доступно по адресу:

```text
http://127.0.0.1:5000
```

Схема базы данных создаётся и обновляется миграциями Flask-Migrate.

### Сборка Tailwind CSS

Tailwind собирается локально через standalone-бинарь (без npm). Файл `static/css/tailwind.css` уже коммитится в репо — пересобирать нужно только при правке шаблонов или добавлении новых утилитарных классов.

1. Скачать бинарь со [страницы релизов Tailwind](https://github.com/tailwindlabs/tailwindcss/releases), переименовать в `tailwindcss.exe` и положить в `loregraph-flask/` (он в `.gitignore`).
2. Собрать минифицированный CSS:
   ```powershell
   .\tailwindcss.exe -i static/css/tailwind-input.css -o static/css/tailwind.css --minify
   ```
3. Для разработки удобнее watch-режим — пересобирает на каждое сохранение шаблона:
   ```powershell
   .\tailwindcss.exe -i static/css/tailwind-input.css -o static/css/tailwind.css --watch
   ```

### Запуск в production (waitress)

```powershell
flask --app app db upgrade
waitress-serve --listen=127.0.0.1:8000 app:app
```

В `.env` дополнительно установить `SESSION_COOKIE_SECURE=1`, если приложение работает поверх HTTPS.

## Администратор

Права администратора выдаются существующему пользователю через CLI-команду:

```powershell
flask --app app make-admin user@example.com
```

После этого в интерфейсе появится доступ к админ-панели.

Такой способ подходит для локальной разработки и учебного проекта: он не требует отдельной публичной формы для назначения ролей и снижает риск случайной выдачи прав.

## Структура репозитория

```text
loregraph/
├── README.md
├── docs/
│   ├── 1_TZ/
│   │   └── LoreGraph-TZ.docx
│   ├── 2_UI-prototype/
│   │   ├── LoreGraph-prototype.html
│   │   ├── LoreGraph-wireframe-dark.svg
│   │   └── figma.txt
│   ├── 3_Diagramms/
│   │   ├── component-loregraph.drawio
│   │   ├── usecase-loregraph.drawio
│   │   └── seq-*.puml
│   ├── 4_ERD for db/
│   │   ├── LoreGraph-ERD.dbdiagram
│   │   └── LoreGraph-ERD.dbml
│   └── 5_analisys/
│       └── LoreGraph-analytics.docx
└── loregraph-flask/
    ├── app.py
    ├── config.py
    ├── extensions.py
    ├── forms.py
    ├── models.py
    ├── storage.py
    ├── docker-compose.yml
    ├── requirements.txt
    ├── ROADMAP.md
    ├── tailwind.config.js
    ├── migrations/        # Alembic
    ├── routes/            # auth, worlds, articles, graph, categories,
    │                      # profile, bookmarks, search, admin
    ├── static/
    │   ├── css/           # styles.css, tailwind-input.css, tailwind.css
    │   ├── js/            # editor, graph, image-cropper, tags, relations, categories
    │   └── uploads/       # пользовательские аватары и обложки (gitignored)
    └── templates/         # base, _navbar, _cropper_modal, errors/,
                           # admin/, auth/, articles/, bookmarks/, graph/,
                           # profile/, search/, settings/, worlds/
```

## Основные модули приложения

- [`app.py`](loregraph-flask/app.py) — фабрика приложения, регистрация расширений и blueprint'ов, обработчики ошибок, CLI-команды.
- [`models.py`](loregraph-flask/models.py) — модели `User`, `World`, `Category`, `Article`, `ArticleVersion`, `Relation`, `Tag`, `Bookmark`, `AdminLog` + `SETTING_PRESETS` для сеттингов.
- [`forms.py`](loregraph-flask/forms.py) — формы авторизации, регистрации, миров, статей, категорий, профиля, загрузки изображений.
- [`storage.py`](loregraph-flask/storage.py) — сохранение изображений в `static/uploads/` с ресайзом, EXIF и защитой от path traversal.
- [`routes/auth.py`](loregraph-flask/routes/auth.py) — регистрация, вход, выход, Google OAuth.
- [`routes/worlds.py`](loregraph-flask/routes/worlds.py) — список, создание, удаление миров, обложка мира.
- [`routes/articles.py`](loregraph-flask/routes/articles.py) — каталог, редактор, автосохранение, обложки статей, версии, теги, закрепление, закладки, связи.
- [`routes/categories.py`](loregraph-flask/routes/categories.py) — категории и поля шаблона.
- [`routes/graph.py`](loregraph-flask/routes/graph.py) — страница графа и JSON-данные для Cytoscape.js.
- [`routes/profile.py`](loregraph-flask/routes/profile.py) — профиль, аватар, смена пароля.
- [`routes/bookmarks.py`](loregraph-flask/routes/bookmarks.py) — кросс-мировой список закладок.
- [`routes/search.py`](loregraph-flask/routes/search.py) — глобальный полнотекстовый поиск.
- [`routes/admin.py`](loregraph-flask/routes/admin.py) — админ-панель с пагинацией, роли, блокировки, удаление миров, журнал действий.

## Документация

- Техническое задание: [`docs/1_TZ/LoreGraph-TZ.docx`](docs/1_TZ/LoreGraph-TZ.docx)
- Анализ предметной области: [`docs/5_analisys/LoreGraph-analytics.docx`](docs/5_analisys/LoreGraph-analytics.docx)
- UI-прототип: [`docs/2_UI-prototype/LoreGraph-prototype.html`](docs/2_UI-prototype/LoreGraph-prototype.html)
- ERD: [`docs/4_ERD for db/LoreGraph-ERD.dbml`](docs/4_ERD%20for%20db/LoreGraph-ERD.dbml)
- Компонентная диаграмма: [`docs/3_Diagramms/component-loregraph.drawio`](docs/3_Diagramms/component-loregraph.drawio)
- Use Case: [`docs/3_Diagramms/usecase-loregraph.drawio`](docs/3_Diagramms/usecase-loregraph.drawio)
- Sequence-диаграммы: [`docs/3_Diagramms/seq-*.puml`](docs/3_Diagramms)

## Ограничения текущей версии

- Для изменения схемы БД используй `flask db migrate` и `flask db upgrade`.
- Приложение рассчитано на локальный запуск.
- Изображения хранятся на локальном диске в `static/uploads`.
- Совместного редактирования и публичного режима просмотра миров пока нет.

План дальнейших работ находится в [`loregraph-flask/ROADMAP.md`](loregraph-flask/ROADMAP.md).
