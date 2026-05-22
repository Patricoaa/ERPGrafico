---
layer: 00-context
doc: stack-decisions
status: active
owner: core-team
last_review: 2026-04-21
---

# Stack Decisions

Why each core dependency exists. Changing any requires ADR.

## Frontend

| Choice | Rationale | ADR |
|--------|-----------|-----|
| Next.js 16 App Router | SSR + RSC for fast dashboards, file-based routing matches FSD | [ADR-0001](../10-architecture/adr/0001-nextjs-app-router.md) |
| TypeScript strict | Zero-any policy, catches errors at compile time | [ADR-0002](../10-architecture/adr/0002-typescript-strict-zero-any.md) |
| Tailwind 4 (`@theme` inline) | Single source of truth in `globals.css`, no config drift | [ADR-0003](../10-architecture/adr/0003-tailwind-v4-theme-inline.md) |
| Shadcn UI | Copy-paste, owned components, no vendor lock | [ADR-0004](../10-architecture/adr/0004-shadcn-ui-base-components.md) |
| TanStack Query | Server state cache, background refetch, devtools | [ADR-0005](../10-architecture/adr/0005-tanstack-query-for-server-state.md) |
| Zod + react-hook-form | Runtime validation matches TS types, zero duplication | [ADR-0006](../10-architecture/adr/0006-zod-react-hook-form-for-all-forms.md) |
| Feature-Sliced Design | Bounded contexts, cross-feature isolation via barrels | [ADR-0007](../10-architecture/adr/0007-feature-sliced-design-frontend-structure.md) |

## Backend

| Choice | Rationale | ADR |
|--------|-----------|-----|
| Django 5 + DRF | Batteries-included, admin, ORM, mature ecosystem | [ADR-0008](../10-architecture/adr/0008-drf-viewsets-service-layer.md) |
| Celery + Redis | Async tasks (invoice PDF, email, reports), scheduled jobs | [ADR-0009](../10-architecture/adr/0009-celery-for-async-side-effects.md) |
| PostgreSQL | JSONB, transactions, row-level locking for reconciliation; FTS via tsvector + GIN | [ADR-0018](../10-architecture/adr/0018-postgresql-tsvector-migration.md) |
| MinIO | S3-compatible, on-prem option, cheap | — |
| JWT auth (`/api/token/`) | Stateless, SPA-friendly | [ADR-0010](../10-architecture/adr/0010-jwt-auth-via-api-token.md) |

## Rejected / not used

| Alternative | Why rejected |
|-------------|--------------|
| tRPC | Django backend forces REST — no end-to-end TS types anyway |
| Prisma | Django ORM is authoritative |
| Redux / Zustand (for server state) | TanStack Query handles it |
| CSS Modules | Tailwind 4 with semantic tokens covers needs |
| MongoDB | Financial data requires ACID transactions |
