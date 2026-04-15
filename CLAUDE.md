# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ERPGrafico is a full-stack ERP system for the graphic/printing industry.

- **Frontend**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4 + Shadcn UI + TanStack Query + Zod
- **Backend**: Django 5 + Django REST Framework + Celery + Redis
- **Database**: PostgreSQL
- **Storage**: MinIO (S3-compatible)

## Development Setup

### Recommended (Hybrid Mode — Windows)

Run infrastructure in Docker, frontend natively for fast HMR:

```bash
# Start backend services (Django, PostgreSQL, Redis, MinIO, Celery)
docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up -d

# Start frontend natively
cd frontend && npm run dev
```

### Full Docker

```bash
docker compose up -d
```

Service ports: Django `8100`, Next.js `3000`, Nginx `80`, Flower `5555`.

## Common Commands

### Frontend (`/frontend`)

```bash
npm run dev       # Dev server with Turbo
npm run build     # Production build
npm run lint      # ESLint
npm run test      # Vitest
npm run type-check  # TypeScript check (must pass before PR)
```

### Backend (inside Docker container or virtualenv)

```bash
python manage.py migrate
python manage.py runserver 0.0.0.0:8100
python manage.py setup_demo_data     # Seed demo data

# Celery
celery -A config worker -l INFO
celery -A config beat -l INFO --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

## Architecture

### Frontend — Feature-Sliced Design

```
app/(dashboard)/[module]/   # Page files only — layout + page component, no business logic
features/[module]/
  components/               # UI components for the module
    forms/
      schema.ts             # Zod schema + derived TypeScript type
  hooks/                    # use[Entity][Action].ts — all data fetching lives here
  index.ts                  # Barrel export (public API of the feature)
components/ui/              # Shadcn base — DO NOT MODIFY
components/shared/          # Promoted shared components — extend here
lib/api.ts                  # Axios instance — only accessible from feature hooks
```

**Cross-feature rule**: A feature must never import internal files of another feature. Use its `index.ts` barrel export, or promote the code to `/components/shared/`.

**Data flow**: `lib/api.ts` → feature hook (`hooks/use*.ts`) → component. Never import `@/lib/api` directly in a component.

### Backend — Django Apps

13 business domain apps: `accounting`, `billing`, `contacts`, `core`, `finances`, `hr`, `inventory`, `production`, `purchasing`, `sales`, `tax`, `treasury`, `workflow`.

All API routes are prefixed with `/api/[module]/`. JWT auth via `/api/token/` and `/api/token/refresh/`.

Custom user model: `core.User`.

## Governance Rules (must follow)

These rules are enforced project-wide. Full details in `frontend/docs/architecture/GOVERNANCE.md`.

### Zero Any Policy
`any` is strictly forbidden in TypeScript. Use strong types derived from Zod schemas, or `unknown` + type guards.

### Naming Conventions
- React components: `PascalCase`
- Custom hooks: `camelCase` with `use` prefix, e.g. `useStockValidation`
- Types/Interfaces: `PascalCase`, no `I` prefix or `Type` suffix
- Config constants: `UPPER_SNAKE_CASE`

### Visual System
- **Do not use raw Tailwind color utilities** (`bg-red-500`, `text-blue-600`). Use only semantic tokens from `frontend/docs/design-system/color-tokens.md`.
- **Primary color**: Electric Violet `oklch(62% 0.244 301)` → `text-primary` / `bg-primary`
- **Fonts**: `font-sans` (Onest) for body, `font-heading` (Syne) for headings
- **Border radius**: `0.25rem` industrial/sharp. No `rounded-xl` or `rounded-full` in form components unless documented
- **Spacing**: 8pt grid — all padding/margin/gap must be multiples of 8px (`0.5rem`)
- **Minimum interactive element height**: `40px` (`h-10`)
- Source of truth for all visual decisions: `frontend/app/globals.css`

### Component Rules
- `StatusBadge` is the **only** authorized component for rendering entity states. No ad-hoc badges.
- All shared components must handle three states: `loading` (Skeleton), `empty` (EmptyState), `error` (Toast).
- All custom hooks must return `{ data, isLoading, error }`.
- All forms must have a separate `schema.ts` with Zod + `react-hook-form`.

### Architecture Decision Records
Any new core dependency, major pattern change, or mass refactor requires a formal ADR in `frontend/docs/architecture/adr/`. No PR may contradict an active ADR.

## Key Documentation

| File | Purpose |
|------|---------|
| `frontend/docs/architecture/GOVERNANCE.md` | Development constitution (51 rules) |
| `frontend/app/globals.css` | Visual source of truth (colors, fonts, tokens) |
| `frontend/docs/design-system/color-tokens.md` | CSS token → Tailwind class → business state mapping |
| `frontend/docs/architecture/component-contracts.md` | Public API for all shared components and hooks |
| `frontend/docs/architecture/BUSINESS_STATES.md` | Entity state definitions per module |
| `frontend/docs/architecture/TESTING.md` | Test strategy and coverage requirements |

## Anti-Patterns

| Prohibited | Use instead |
|-----------|------------|
| `any` in TypeScript | `unknown` + type guard, or Zod-derived type |
| `useQuery` directly in a UI component | Wrap in a feature hook |
| Modifying `/components/ui/` | Extend in `/components/shared/` |
| Importing internals from another feature | Use barrel export or promote to `/shared` |
| Ad-hoc status badges | `StatusBadge` with correct `type` and `status` |
| Hardcoded colors in `style={{}}` | CSS variables via Tailwind semantic classes |
| Raw Tailwind colors (`bg-red-500`) | Semantic tokens from `color-tokens.md` |
