# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Agent compatibility

These rules and conventions apply to any LLM agent used in this repository (Claude, Codex/Cursor, or others).
If style differences exist across agents, this document's invariants and playbooks always take precedence.

## Primary entry point for agentic work

**Start here:** [docs/README.md](docs/README.md) — layered documentation with explicit task routing. Match the user's intent to a playbook in the routing table, read the playbook's preconditions, then execute.

Layer map:

| Layer | Folder | When to read |
|-------|--------|--------------|
| 00 | [docs/00-context/](docs/00-context/) | First contact: project overview, domain glossary, stack rationale |
| 10 | [docs/10-architecture/](docs/10-architecture/) | Before any structural change; includes ADRs |
| 20 | [docs/20-contracts/](docs/20-contracts/) | Before consuming or exposing components, hooks, endpoints, states |
| 30 | [docs/30-playbooks/](docs/30-playbooks/) | Every implementation task |
| 40 | [docs/40-quality/](docs/40-quality/) | Testing, security, observability, performance, CI/CD |
| 90 | [docs/90-governance/](docs/90-governance/) | Rules + PR checklist + zero-any policy |

Task routing — common intents:

| Intent | Playbook |
|--------|----------|
| New feature / entity UI | [add-feature.md](docs/30-playbooks/add-feature.md) |
| New REST endpoint | [add-endpoint.md](docs/30-playbooks/add-endpoint.md) |
| Promote / create shared component | [add-shared-component.md](docs/30-playbooks/add-shared-component.md) |
| Change Zod schema / form | [modify-schema.md](docs/30-playbooks/modify-schema.md) |
| DB migration | [add-migration.md](docs/30-playbooks/add-migration.md) |
| Celery / scheduled task | [add-background-task.md](docs/30-playbooks/add-background-task.md) |
| Bug / regression | [debug-workflow.md](docs/30-playbooks/debug-workflow.md) |
| Refactor / rename | [refactor-workflow.md](docs/30-playbooks/refactor-workflow.md) |
| Deprecate / remove | [deprecate-feature.md](docs/30-playbooks/deprecate-feature.md) |
| File upload / attachment / MinIO | [add-file-upload.md](docs/30-playbooks/add-file-upload.md) |
| Permission / role / RBAC / access guard | [add-role-permission.md](docs/30-playbooks/add-role-permission.md) |
| N+1 query / selector / prefetch | [add-selector.md](docs/30-playbooks/add-selector.md) |
| Settings panel / config section | [add-settings-panel.md](docs/30-playbooks/add-settings-panel.md) |
| Which component to use / component decision | [component-decision-tree.md](docs/20-contracts/component-decision-tree.md) |
| Badge / chip / pill for a label or tag | [component-chip.md](docs/20-contracts/component-chip.md) |
| Module layout / navigation tabs / dynamic header | [module-layout-navigation.md](docs/20-contracts/module-layout-navigation.md) |
| TypeScript error / `any` escape hatch | [resolve-type-errors.md](docs/30-playbooks/resolve-type-errors.md) |
| Loading state / skeleton / refetch CLS / loading.tsx | [component-skeleton.md](docs/20-contracts/component-skeleton.md) |
| Deletion / annul / archive / soft-delete / hard delete | [deletion-policy.md](docs/20-contracts/deletion-policy.md) |
| Realtime (WebSocket / SSE / Django Channels / push) | [realtime-channels.md](docs/20-contracts/realtime-channels.md) |
| Idempotency-Key for write endpoints / double-click safety | [idempotency.md](docs/20-contracts/idempotency.md) |
| Export PDF / Excel / CSV (WeasyPrint / openpyxl) | [export-formats.md](docs/20-contracts/export-formats.md) |
| Bulk import (CSV / XLSX) / preview + commit | [import-csv-xlsx.md](docs/20-contracts/import-csv-xlsx.md) |
| Implement new realtime channel (WS or SSE) | [add-realtime-channel.md](docs/30-playbooks/add-realtime-channel.md) |
| Implement new export PDF/Excel/CSV | [add-export-pdf-excel.md](docs/30-playbooks/add-export-pdf-excel.md) |
| Implement new bulk import | [add-bulk-import.md](docs/30-playbooks/add-bulk-import.md) |
| Postgres backup / restore / disaster recovery | [backup-and-restore-postgres.md](docs/30-playbooks/backup-and-restore-postgres.md) + [disaster-recovery-pyme.md](docs/30-playbooks/disaster-recovery-pyme.md) |
| Feature aggregator pattern (no root barrel, no own backend) | [frontend-fsd.md#aggregator-pattern](docs/10-architecture/frontend-fsd.md#aggregator-pattern-read-only-feature-without-root-barrel) |

Full routing table in [docs/README.md](docs/README.md).

## Pre-flight checklist (every implementation task)

Before writing any code, verify:

- [ ] Matched intent in routing table and read target playbook fully
- [ ] Consulted [component-decision-tree.md](docs/20-contracts/component-decision-tree.md) — do not reinvent components that exist
- [ ] Read `frontend/app/globals.css` to verify available semantic color tokens before adding styles
- [ ] Verified global invariants below are not violated

## Global invariants (violate = PR rejected)

1. **Zero `any`** in TypeScript — use Zod-derived types or `unknown` + type guard. See [zero-any-policy.md](docs/90-governance/zero-any-policy.md).
2. **No raw Tailwind colors** (`bg-red-500`, `text-blue-600`) — semantic tokens only (`bg-primary`, `text-muted-foreground`).
3. **No cross-feature internal imports** — import from feature barrel `index.ts` only.
4. **No `useQuery`/`useMutation` directly in components** — wrap in a feature hook under `features/*/hooks/`.
5. **No direct `@/lib/api` in components or pages** — only importable from `features/*/api/`, `features/*/hooks/`, and `/hooks/`.
6. **Shared components imported via barrel only** — `import { X } from '@/components/shared'`, never the file path directly.
7. **`StatusBadge` is the only authorized status renderer.**
8. **All forms** use `react-hook-form` + `zodResolver` with schema in `components/forms/schema.ts`.
9. **Views ≤ 20 lines** per Django action — business logic goes in `services.py`.

## Rule precedence

If a conflict appears, apply this priority order:

1. Global invariants (PR reject rules)
2. Task-specific playbook (`docs/30-playbooks`)
3. Component/API/state contracts (`docs/20-contracts`)
4. Architecture and style conventions

## Definition of done (minimum)

Before considering a task complete:

- Frontend: `npm run type-check` and `npm run lint` pass with no errors
- Tests: run at least the test scope affected by the change
- Global invariants remain respected (zero `any`, allowed imports, hooks policy, etc.)
- If contracts changed, update relevant documentation/contracts

## Planning vs execution

- Plan mode: define approach, scope, risks, and files to touch; no code changes
- Execution mode: implement following the selected playbook and validate the minimum DoD
- If the task is ambiguous or has major trade-offs, plan first

## Stack (short)

- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind 4, Shadcn UI, TanStack Query, Zod, react-hook-form
- **Backend**: Django 5 + DRF, Celery, Redis
- **DB**: PostgreSQL — **Storage**: MinIO
- **Tailwind v4**: NO `tailwind.config.ts`. Theme via `@theme` inline in [frontend/app/globals.css](frontend/app/globals.css).

Detail: [docs/00-context/stack-decisions.md](docs/00-context/stack-decisions.md).

## Common commands

### Dev setup — hybrid mode (recommended on Windows)

```bash
docker compose -f docker-compose.yml -f docker-compose.hybrid.yml up -d
cd frontend && npm run dev
```

Full docker: `docker compose up -d`. Ports: Django `8100`, Next.js `3000`, Nginx `80`, Flower `5555`.

### Frontend (`/frontend`)

```bash
npm run dev               # Turbo dev server
npm run build             # Production build
npm run lint              # ESLint
npm run test              # Vitest (full)
npm run test -- <path>    # Single file
npm run type-check        # Type-check — must pass before PR
```

### Backend

```bash
python manage.py migrate
python manage.py runserver 0.0.0.0:8100
python manage.py setup_demo_data

# Tests
pytest                                # all
pytest backend/sales/tests -v            # one app
pytest backend/sales/tests/test_views.py::test_create_order   # one test

# Celery
celery -A config worker -l INFO
celery -A config beat -l INFO --scheduler django_celery_beat.schedulers:DatabaseScheduler
```

## Architecture big picture

Reading order for a new agent:

1. [docs/00-context/project-overview.md](docs/00-context/project-overview.md) — what ERPGrafico is, 13 Django apps.
2. [docs/10-architecture/system-diagram.md](docs/10-architecture/system-diagram.md) — runtime topology, request lifecycle, trust boundaries.
3. [docs/10-architecture/frontend-fsd.md](docs/10-architecture/frontend-fsd.md) — Feature-Sliced layout, import rules, data flow (`lib/api` → feature hook → component).
4. [docs/10-architecture/backend-apps.md](docs/10-architecture/backend-apps.md) — view/service/selector layering; views ≤20 lines.
5. [docs/10-architecture/data-flow.md](docs/10-architecture/data-flow.md) — read/write lifecycle, cache invalidation, error propagation.

