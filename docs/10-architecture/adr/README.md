---
layer: 10-architecture
doc: adr-index
status: active
owner: core-team
last_review: 2026-05-28
---

# Architecture Decision Records

## When an ADR is required

- New core dependency (runtime, framework, major lib).
- Mass refactor affecting ≥3 features / ≥3 apps.
- Change to any contract in `/docs/20-contracts/`.
- Change to a global invariant (`CLAUDE.md` / `docs/README.md`, authoritative in `90-governance/GOVERNANCE.md`).
- New cross-cutting pattern (auth, caching, error handling).

No PR may merge if it contradicts an `Accepted` ADR without first superseding it.

## Format

Filename: `NNNN-kebab-title.md` — NNNN is zero-padded sequence.

```markdown
---
id: NNNN
title: …
status: Proposed | Accepted | Superseded by NNNN | Deprecated
date: YYYY-MM-DD
author: …
---

# NNNN — Title

## Context
What forces motivate this decision. What constraints exist.

## Decision
The chosen approach, stated as an instruction.

## Consequences
Positive, negative, neutral. What becomes easier, what becomes harder.

## Alternatives considered
Briefly — what else, why rejected.

## References
Links to playbooks, contracts, external docs.
```

## Lifecycle

```
Proposed → (review) → Accepted → (later) → Superseded | Deprecated
```

- `Proposed`: open PR, under review.
- `Accepted`: merged, enforceable.
- `Superseded by NNNN`: replaced; link forward, keep file for history.
- `Deprecated`: no longer applies; link to replacement context.

## Index

| ID | Title | Status |
|----|-------|--------|
| [0001](0001-nextjs-app-router.md) | Next.js App Router | Accepted |
| [0002](0002-typescript-strict-zero-any.md) | TypeScript strict + zero-any | Accepted |
| [0003](0003-tailwind-v4-theme-inline.md) | Tailwind v4 `@theme` inline | Accepted |
| [0004](0004-shadcn-ui-base-components.md) | Shadcn UI base components | Accepted |
| [0005](0005-tanstack-query-for-server-state.md) | TanStack Query for server state | Accepted |
| [0006](0006-zod-react-hook-form-for-all-forms.md) | Zod + react-hook-form for all forms | Accepted |
| [0007](0007-feature-sliced-design-frontend-structure.md) | Feature-Sliced Design frontend structure | Accepted |
| [0008](0008-drf-viewsets-service-layer.md) | DRF ViewSets + service layer | Accepted |
| [0009](0009-celery-for-async-side-effects.md) | Celery for async side effects | Accepted |
| [0010](0010-jwt-auth-via-api-token.md) | JWT auth via `/api/token/` | Accepted |
| [0011](0011-centralized-autosave-for-settings-panels.md) | Centralized autosave for settings panels | Accepted |
| [0012](0012-unified-system-versioning.md) | Unified system versioning | Accepted |
| [0013](0013-action-dock-pattern.md) | ActionDock pattern for floating tasks | Accepted |
| [0014](0014-decimal-places-transactional-totals.md) | `decimal_places=0` for transactional document totals | Accepted |
| [0015](0015-document-service-and-metadata-schema.md) | DocumentService and Metadata Schema for UI Forms | Superseded by 0020 / 0025 §2.2 |
| [0016](0016-post-refactor-architecture-f5.md) | Post-refactor architecture — F5 GenericForeignKey + ProductTypeStrategy | Accepted |
| [0017](0017-feature-flags-decision.md) | Omit feature flags in architectural refactor (big-bang) | Accepted |
| [0018](0018-postgresql-tsvector-migration.md) | PostgreSQL `tsvector` migration for UniversalSearch | Accepted |
| [0019](0019-entity-detail-route-convention.md) | Searchable Entity Detail Route convention | Superseded by 0020 (detail mechanism; D-02/D-03 slug tables still apply) |
| [0020](0020-modal-on-list-edit-ux.md) | Modal-on-List Edit UX (URL-State Pattern) | Accepted (partially supersedes 0025 §2.2) |
| [0021](0021-reconciliation-routing.md) | Bank Reconciliation Routing Strategy | Accepted |
| [0022](0022-list-url-source-of-truth.md) | Source of Truth for `list_url` of searchable entities | Accepted |
| [0023](0023-expand-row-actions-registry.md) | Expand `ROW_ACTIONS` registry with transactional verbs | Accepted |
| [0024](0024-strategy-pattern-services.md) | Strategy Pattern + Service Layer (Refactor Fase 3) | Accepted |
| [0025](0025-schema-driven-forms-revert-and-expand.md) | Schema-Driven Forms — Phase 4 revert + blacklist | Accepted (§2.2 superseded by 0020) |
| [0026](0026-entity-bus-realtime-invalidation.md) | Entity-bus WebSocket for realtime query invalidation | Accepted |
| [0027](0027-basedrawer-crud-forms.md) | BaseDrawer as Primary Surface for Embedded CRUD Forms | Accepted |
| [0028](0028-entity-drawer-registry.md) | Global entity-drawer registry + dual-mode drawers (replaces TransactionViewModal) | Accepted |
| [0029](0029-color-system-robustening.md) | Color system robustening — info→blue, neutral accent, fixed L1 / adaptive L2, data-viz palette | Accepted |
| [0030](0030-datatable-compact-variant.md) | DataTable compact variant (CSS Grid for modals/drawers) | Proposed |
| [0031](0031-treasury-account-vs-payment-method-taxonomy.md) | Treasury account vs payment method — two-layer taxonomy (wizard + auto-provision + convergence) | Accepted |
| [0032](0032-check-portfolio-cuenta-puente.md) | Cheques recibidos — cartera con cuenta puente CHECK_PORTFOLIO | Accepted |

> **Lint:** este índice debe coincidir 1-a-1 con los archivos `NNNN-*.md` presentes en este directorio. Cualquier ADR nuevo o renombramiento exige actualizar también esta tabla.
