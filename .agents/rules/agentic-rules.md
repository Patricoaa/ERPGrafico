---
trigger: always_on
---

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

Full routing table in [docs/README.md](docs/README.md).

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
npx tsc --noEmit          # Type-check — must pass before PR
```

Note: `type-check` script not yet in `package.json`. Add: `"type-check": "tsc --noEmit"`.

### Backend

```bash
python manage.py migrate
python manage.py runserver 0.0.0.0:8100
python manage.py setup_demo_data

# Tests
pytest                                # all
pytest apps/sales/tests -v            # one app
pytest apps/sales/tests/test_views.py::test_create_order   # one test

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

