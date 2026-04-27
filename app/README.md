# LoreGraph — приложение

Фронтенд-приложение конструктора интерактивных вики LoreGraph.

## Стек

Vite + React 18 + TypeScript • Tailwind CSS • Radix UI + кастомный shadcn-style набор • TipTap (редактор) • react-force-graph-2d (граф) • Supabase (Auth + Postgres + RLS).

## Запуск

```bash
npm install
npm run dev
```

Откроется на `http://localhost:5173`.

Файл `.env.local` уже содержит ключи подключения к проекту Supabase `loregraph` (URL + публичный ключ). Для собственного окружения скопируй `.env.example`.

## Скрипты

- `npm run dev` — dev-сервер с HMR
- `npm run build` — production-сборка (typecheck + Vite build)
- `npm run typecheck` — только TypeScript
- `npm run preview` — превью production-сборки

## Структура

```
src/
├── lib/              # supabase-клиент, database.types, утилиты
├── components/
│   ├── ui/           # shadcn-style примитивы (button, input, dialog, ...)
│   └── ...           # доменно-нейтральные компоненты
├── hooks/            # useAuth, useToast, useDebounce
├── routes/           # лейауты и страницы
└── features/         # фичи: worlds, articles, relations, graph
```

## Аутентификация и доступ

Аутентификация через Supabase Auth (email/password + Google OAuth). Все запросы к данным проходят через **RLS-политики** в Postgres — приложение не имеет привилегированного API-слоя. JWT передаётся клиентом Supabase автоматически.

Триггер `on_auth_user_created` создаёт запись в `profiles` сразу после регистрации в `auth.users`. Триггер `on_project_created` сидит 5 предустановленных категорий (Персонаж/Локация/Событие/Предмет/Фракция) при создании мира.
