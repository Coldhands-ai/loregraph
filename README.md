# LoreGraph

**LoreGraph** — учебное веб-приложение для создания персональных вики с интерактивным графом связей.

Пользователь создаёт миры, наполняет их статьями о персонажах, локациях, событиях, предметах и фракциях, задаёт именованные связи между статьями и просматривает структуру мира как граф.

Проект реализован как Flask-приложение в каталоге [`loregraph-flask`](loregraph-flask).

## Возможности

- Регистрация и вход по email/паролю.
- Опциональный вход через Google OAuth.
- Личный список миров пользователя.
- Автоматическое создание базовых категорий для нового мира: персонаж, локация, событие, предмет, фракция.
- Управление категориями: название, цвет, иконка, вес узла на графе, поля шаблона.
- Каталог статей с поиском, фильтром по категориям и закреплёнными материалами.
- Редактор статьи с Markdown/WYSIWYG-режимом, автосохранением, обложкой и структурированными полями категории.
- Именованные направленные связи между статьями с автокомплитом.
- Интерактивный граф на Cytoscape.js: цвет и размер узлов зависят от категории, доступны поиск и фильтрация.
- Профиль пользователя: имя, аватар, смена пароля.
- Админ-панель: статистика, пользователи, блокировка, выдача роли администратора, просмотр и удаление миров, журнал действий.

## Стек

**Backend:** Python 3.13, Flask 3, SQLAlchemy 2, Flask-Login, Flask-WTF, Authlib, bcrypt, Pillow.

**Database:** PostgreSQL 17 в Docker.

**Frontend:** Jinja2, Tailwind CSS через CDN, Alpine.js, Toast UI Editor, Cytoscape.js.

Проект не использует фронтенд-сборщик и `node_modules`: страницы рендерятся на сервере, а JavaScript подключается точечно для редактора, графа, категорий и связей.

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

# 4. Запустить приложение
flask --app app run --debug
```

После запуска приложение доступно по адресу:

```text
http://127.0.0.1:5000
```

Схема базы данных создаётся автоматически при первом запуске приложения.

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
    ├── README.md
    ├── routes/
    ├── static/
    └── templates/
```

## Основные модули приложения

- [`app.py`](loregraph-flask/app.py) — создание Flask-приложения, регистрация расширений, маршрутов и CLI-команды администратора.
- [`models.py`](loregraph-flask/models.py) — модели `User`, `World`, `Category`, `Article`, `Relation`, `AdminLog`.
- [`forms.py`](loregraph-flask/forms.py) — формы авторизации, регистрации, миров, статей, категорий, профиля и загрузки изображений.
- [`storage.py`](loregraph-flask/storage.py) — проверка и сохранение изображений в `static/uploads`.
- [`routes/auth.py`](loregraph-flask/routes/auth.py) — регистрация, вход, выход, Google OAuth.
- [`routes/worlds.py`](loregraph-flask/routes/worlds.py) — список, создание и удаление миров.
- [`routes/articles.py`](loregraph-flask/routes/articles.py) — каталог статей, редактор, автосохранение, обложки, закрепление и связи.
- [`routes/categories.py`](loregraph-flask/routes/categories.py) — управление категориями и полями шаблона.
- [`routes/graph.py`](loregraph-flask/routes/graph.py) — страница графа и JSON-данные для Cytoscape.js.
- [`routes/profile.py`](loregraph-flask/routes/profile.py) — профиль, аватар и смена пароля.
- [`routes/admin.py`](loregraph-flask/routes/admin.py) — админ-панель, роли, блокировки, удаление миров и журнал действий.

## Документация

- Техническое задание: [`docs/1_TZ/LoreGraph-TZ.docx`](docs/1_TZ/LoreGraph-TZ.docx)
- Анализ предметной области: [`docs/5_analisys/LoreGraph-analytics.docx`](docs/5_analisys/LoreGraph-analytics.docx)
- UI-прототип: [`docs/2_UI-prototype/LoreGraph-prototype.html`](docs/2_UI-prototype/LoreGraph-prototype.html)
- ERD: [`docs/4_ERD for db/LoreGraph-ERD.dbml`](docs/4_ERD%20for%20db/LoreGraph-ERD.dbml)
- Компонентная диаграмма: [`docs/3_Diagramms/component-loregraph.drawio`](docs/3_Diagramms/component-loregraph.drawio)
- Use Case: [`docs/3_Diagramms/usecase-loregraph.drawio`](docs/3_Diagramms/usecase-loregraph.drawio)
- Sequence-диаграммы: [`docs/3_Diagramms/seq-*.puml`](docs/3_Diagramms)

## Ограничения текущей версии

- База данных создаётся через `db.create_all()`, миграции пока не подключены.
- Приложение рассчитано на локальный запуск.
- Изображения хранятся на локальном диске в `static/uploads`.
- Совместного редактирования и публичного режима просмотра миров пока нет.

План дальнейших работ находится в [`loregraph-flask/ROADMAP.md`](loregraph-flask/ROADMAP.md).
