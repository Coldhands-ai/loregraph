# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> The parent [c:\TopAcademy\.claude\CLAUDE.md](../../../.claude/CLAUDE.md) defines global working rules (Rule 1–7: simplicity, visual quality, code quality, language, senior-level professionalism, solution size matches task size, no hallucinations). This file extends them with LoreGraph-specific details and does not duplicate them.

## Repository Status

The repository currently contains **documentation only** — no code yet. All artifacts live in [docs/](docs/):

- [docs/1_TZ/LoreGraph-TZ.docx](docs/1_TZ/LoreGraph-TZ.docx) — technical specification
- [docs/2_UI-prototype/](docs/2_UI-prototype/) — HTML prototype, SVG wireframe, Figma link
- [docs/3_Diagramms/](docs/3_Diagramms/) — PlantUML sequence diagrams (`seq-*.puml`), drawio component and use-case diagrams
- [docs/4_ERD for db/LoreGraph-ERD.dbml](docs/4_ERD%20for%20db/LoreGraph-ERD.dbml) — DB schema in DBML format (for dbdiagram.io)
- [docs/5_analisys/LoreGraph-analytics.docx](docs/5_analisys/LoreGraph-analytics.docx) — analytics

`.docx` files cannot be read directly — convert when needed (`pandoc`, `python-docx`) or ask the user to export to md/txt.

## Product

**LoreGraph** is a constructor for interactive wikis with a relationship graph. A user creates "worlds" (projects), populates them with "articles" categorized as Character / Location / Event / Item / Faction, defines named directed relations between articles, and views everything as an interactive force graph.

Key features: WYSIWYG article editor (TipTap JSON), covers and avatars via Storage, tags, article versioning, bookmarks, admin panel with action log, Google OAuth.

## Target Stack

Fixed in [docs/3_Diagramms/component-loregraph.drawio](docs/3_Diagramms/component-loregraph.drawio):

**Frontend** (Vite + React + TypeScript):
- UI: shadcn/ui + Tailwind CSS (dark theme, palette in the HTML prototype)
- Routing: React Router v6 (with `ProtectedRoute` for protected routes)
- Article editor: TipTap (content stored as JSON in `articles.content`)
- Graph: `react-force-graph` (nodes = articles, edges = relations, node color = `category.color`)
- Admin charts/stats: Recharts
- Supabase client: `@supabase/supabase-js`

**Backend — Supabase BaaS** (no custom API layer):
- Auth: email/password + Google OAuth, JWT (access + refresh)
- Postgres: all business logic lives in the DB
- Storage: buckets for avatars, world covers, article covers
- Authorization — through **RLS policies** (`user_id = auth.uid()`), not backend code. This is the central architectural decision: all access checks happen in Postgres against the JWT from the `Authorization: Bearer` header.

## Architectural Invariants (from ERD and sequence diagrams)

Keep these in mind when writing code, otherwise you will drift from the documentation:

- **`profiles.id` = `auth.users.id`** — the profile row is created by a **trigger** on Supabase Auth registration, not from the application. The client only upserts `display_name` / `avatar_url`.
- **Creating a world → auto-create 5 preset categories** (Character #3B82F6, Location #10B981, Event #F59E0B, Item #EF4444, Faction #8B5CF6). Implement via trigger/RPC rather than relying on the client.
- **Article content is TipTap JSON** in `articles.content` (jsonb). Never store as plain HTML/markdown.
- **Article auto-save** — 2-second debounce on the client; a new `article_versions` row is created **not on every auto-save**, but on manual save / on a timer (~10 min).
- **`relations` are directed** (source → target) but rendered as two-sided on the graph. `source = target` is forbidden (CHECK constraint). Unique on `(source, target, label)`.
- **Article category is optional** (`category_id NULL`); a relation belongs to a world (`relations.project_id`) — this is required for RLS and fast queries without joining through articles.
- **Admin ≠ data owner**: the `profiles.role = 'admin'` role grants access to all profiles/projects via separate RLS policies. All admin actions are written to `admin_logs` (append-only, no delete).
- **Tags / relation_types are project-scoped** (`UNIQUE (project_id, name)`) — there are no global tags.

## Sequence Diagrams as Contract

Before implementing any user-facing scenario, cross-check the corresponding `seq-*.puml` in [docs/3_Diagramms/](docs/3_Diagramms/) — it pins down the call order between client ↔ Supabase Auth ↔ Postgres ↔ Storage. If the implementation diverges from the diagram, update the diagram rather than silently drifting.

| Scenario | File |
|---|---|
| Registration (email + Google OAuth) | `seq-registration.puml` |
| Login, route protection, refresh | `seq-auth.puml` |
| Article create/edit, cover, tags | `seq-article.puml` |
| Relation management (CRUD + autocomplete) | `seq-relations.puml` |
| Graph loading and interaction (hover/click/filter/search) | `seq-graph.puml` |
