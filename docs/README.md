---
status: active
owner: core-team
last_review: 2026-06-19
---

# ERPGrafico — Documentation Router

> Punto de entrada único para modelos agentivos y humanos. Encuentra tu objetivo en la tabla, salta al playbook. No saltes los pre-requisitos.

## How to use this documentation

1. **Identify intent** in the Task Routing table below.
2. **Read preconditions** listed in the target playbook frontmatter.
3. **Execute steps** in order. Do not skip validation.
4. **Stop and ask** if a precondition contradicts current code — never invent.

## Layer map

| Layer | Folder | Purpose | When to read |
|-------|--------|---------|--------------|
| 00 | `00-context/` | What project is, domain vocabulary, stack | First contact with repo |
| 10 | `10-architecture/` | How pieces fit together, ADRs | Before structural change |
| 20 | `20-contracts/` | Public APIs (components, hooks, endpoints, state, **entity identity**) | Before consuming or exposing API |
| 30 | `30-playbooks/` | Step-by-step recipes for common tasks | Every implementation task |
| 40 | `40-quality/` | Testing, security, observability, performance, CI/CD | Cross-cutting concerns |
| 50 | `50-audit/` | Major refactor audits and roadmaps | Before launching multi-sprint refactor |
| 90 | `90-governance/` | Rules, policies, decision records | Before proposing deviation |

## Task Routing — intent → playbook

| Intent / Trigger phrases | Playbook | Layer |
|--------------------------|----------|-------|
| “new feature”, “add module”, “create entity CRUD” | [add-feature.md](30-playbooks/add-feature.md) | 30 |
| “new endpoint”, “expose API”, “REST route” | [add-endpoint.md](30-playbooks/add-endpoint.md) | 30 |
| “shared component”, “promote to /shared”, “reusable UI” | [add-shared-component.md](30-playbooks/add-shared-component.md) | 30 |
| “modify schema”, “add field”, “change Zod”, “alter form” | [modify-schema.md](30-playbooks/modify-schema.md) | 30 |
| “migration”, “alter table”, “new model” | [add-migration.md](30-playbooks/add-migration.md) | 30 |
| “Celery task”, “background job”, “scheduled” | [add-background-task.md](30-playbooks/add-background-task.md) | 30 |
| “bug”, “failing test”, “unexpected behavior”, “Celery task missing” | [debug-workflow.md](30-playbooks/debug-workflow.md) | 30 |
| “refactor”, “extract”, “rename” | [refactor-workflow.md](30-playbooks/refactor-workflow.md) | 30 |
| “deprecate”, “remove feature”, “sunset” | [deprecate-feature.md](30-playbooks/deprecate-feature.md) | 30 |
| “file upload”, “attachment”, “FileField”, “MinIO”, “document” | [add-file-upload.md](30-playbooks/add-file-upload.md) | 30 |
| “permission”, “role”, “access control”, “RBAC”, “guard” | [add-role-permission.md](30-playbooks/add-role-permission.md) | 30 |
| “selector”, “N+1”, “select_related”, “prefetch_related”, “slow query” | [add-selector.md](30-playbooks/add-selector.md) | 30 |
| “home server”, “low resources”, “old pc”, “ssh development”, “remote setup” | [home-server-setup.md](30-playbooks/home-server-setup.md) | 30 |
| “what is X”, “domain term”, “glossary” | [domain-glossary.md](00-context/domain-glossary.md) | 00 |
| “architecture”, “folder structure”, “where does X go” | [frontend-fsd.md](10-architecture/frontend-fsd.md) / [backend-apps.md](10-architecture/backend-apps.md) | 10 |
| “which component”, “component decision”, “what to use” | [component-decision-tree.md](20-contracts/component-decision-tree.md) | 20 |
| “Schema-driven form”, “EntityForm”, “backend form” | ~~[schema-driven-forms.md](20-contracts/schema-driven-forms.md)~~ — **superseded** por [ADR-0020](10-architecture/adr/0020-modal-on-list-edit-ux.md). No usar `EntityForm` en código nuevo. | 20 |
| “component API”, “prop signature”, “StatusBadge usage” | [component-contracts.md](20-contracts/component-contracts.md) | 20 |
| “Drawer API”, “drawer contract”, “BaseDrawer”, “cómo usar Drawer”, “tamaño de drawer”, “formDrawerWidth” | [component-drawer.md](20-contracts/component-drawer.md) | 20 |
| “selector component”, “entity search”, “combobox”, “AccountSelector” | [component-selectors.md](20-contracts/component-selectors.md) | 20 |
| “module layout”, “navigation pattern”, “dynamic header”, “module tabs” | [module-layout-navigation.md](20-contracts/module-layout-navigation.md) | 20 |
| “form size”, “form pattern”, “when to use tabs”, “wizard vs form”, “form surface”, “form layout” | [component-form-patterns.md](20-contracts/component-form-patterns.md) | 20 |
| “edit modal”, “list edit”, “?selected param”, “open modal from search”, “detail from search” | [list-modal-edit-pattern.md](20-contracts/list-modal-edit-pattern.md) | 20 |
| “hook signature”, “return shape” | [hook-contracts.md](20-contracts/hook-contracts.md) | 20 |
| “pagination”, “page_size”, “count next previous”, “manualPagination”, “DataTable footer mal cuenta”, “lista truncada a 50”, “Page<T>”, “envoltorio DRF” | [pagination-contract.md](20-contracts/pagination-contract.md) | 20 |
| “entity state”, “status values” | [state-map.md](20-contracts/state-map.md) | 20 |
| “testing strategy”, “coverage”, “fixtures” | [testing.md](40-quality/testing.md) | 40 |
| “auth”, “permissions”, “injection”, “security review” | [security.md](40-quality/security.md) | 40 |
| “logs”, “metrics”, “traces”, “alerting” | [observability.md](40-quality/observability.md) | 40 |
| “slow”, “optimize”, “query N+1”, “bundle size” | [performance.md](40-quality/performance.md) | 40 |
| “deploy”, “pipeline”, “CI failure” | [ci-cd.md](40-quality/ci-cd.md) | 40 |
| “any type”, “TypeScript unknown”, “type escape hatch” | [zero-any-policy.md](90-governance/zero-any-policy.md) | 90 |
| “versioning”, “release process”, “SemVer”, “how to version” | [versioning-policy.md](90-governance/versioning-policy.md) | 90 |
| “naming”, “sufijo de componente”, “FormModal prohibido”, “cómo nombrar”, “Drawer vs Modal”, “nombre de archivo”, “naming hook”, “naming type” | [naming-conventions.md](90-governance/naming-conventions.md) | 90 |
| “ADR”, “decision record”, “major change” | [adr/README.md](10-architecture/adr/README.md) | 10 |
| “signals”, “signal receiver”, “post_save hook”, “cross-app event” | [workflow-signals-registry.md](10-architecture/workflow-signals-registry.md) | 10 |
| “entity identity”, “entity prefix”, “registry”, “display id”, “centralized icons” | [entity-identity.md](20-contracts/entity-identity.md) | 20 |
| “searchable entity”, “global search”, “index”, “rebuild search” | [add-searchable-entity.md](30-playbooks/add-searchable-entity.md) | 30 |
| “generic form”, “universal registry”, “metadata schema”, “data-driven UI”, “Django architecture refactor” | [50-audit/Arquitectura Django/README.md](50-audit/Arquitectura%20Django/README.md) | 50 |
| “DataTable”, “view mode”, “card view”, “kanban view”, “view switching”, “cardMode”, “isLoading skeleton”, “EntityCard”, “variant embedded” | [component-datatable-views.md](20-contracts/component-datatable-views.md) | 20 |
| “ProductSelector”, “selector de productos shared”, “migrar POS selector”, “CategoryFilter shared”, “ProductGrid shared”, “VariantSelectorModal shared” | [50-audit/POSSelector/README.md](50-audit/POSSelector/README.md) | 50 |
| “stale cache”, “queryKey mismatch”, “FSD compliance”, “invariante #4”, “invariante #5”, “raw api en componente”, “useMutation en componente”, “refactor data layer” | [50-audit/fsddata/fsd-data-layer-audit.md](50-audit/fsddata/fsd-data-layer-audit.md) + [refactor-plan](50-audit/fsddata/fsd-data-layer-refactor-plan.md) | 50 |
| “delete entity”, “borrar”, “anular”, “archivar”, “soft delete”, “hard delete”, “archive vs annul”, “is_active”, “status=cancelled” | [deletion-policy.md](20-contracts/deletion-policy.md) | 20 |
| “realtime”, “WebSocket”, “SSE”, “EventSource”, “Django Channels”, “live update”, “push notification”, “useDraftSync”, “useNotifications” | [realtime-channels.md](20-contracts/realtime-channels.md) | 20 |
| “entity drawer”, “openEntity”, “drawer registry”, “abrir documento origen”, “SourceDocumentLink”, “drill-down”, “drawer modes (view/edit/create)”, “TransactionViewModal” | [component-entity-drawers.md](20-contracts/component-entity-drawers.md) | 20 |
| “idempotency”, “Idempotency-Key”, “double-click”, “duplicate request”, “retry safe” | [idempotency.md](20-contracts/idempotency.md) | 20 |
| “export PDF”, “export Excel”, “export CSV”, “WeasyPrint”, “openpyxl”, “generar reporte descargable”, “libro de ventas xlsx” | [export-formats.md](20-contracts/export-formats.md) | 20 |
| “import CSV”, “import Excel”, “bulk upload”, “importar contactos/productos”, “column mapping”, “preview import”, “DataManagement” | [import-csv-xlsx.md](20-contracts/import-csv-xlsx.md) | 20 |
| “agregar realtime”, “nuevo consumer WS”, “nuevo endpoint SSE”, “implementar notificación live” | [add-realtime-channel.md](30-playbooks/add-realtime-channel.md) | 30 |
| “agregar export PDF/Excel”, “generar factura PDF”, “implementar libro xlsx”, “descarga de reporte” | [add-export-pdf-excel.md](30-playbooks/add-export-pdf-excel.md) | 30 |
| “agregar import CSV/XLSX”, “implementar bulk upload”, “preview + commit import” | [add-bulk-import.md](30-playbooks/add-bulk-import.md) | 30 |
| “backup Postgres”, “pg_dump”, “restore”, “subir backup a R2”, “test mensual de backup” | [backup-and-restore-postgres.md](30-playbooks/backup-and-restore-postgres.md) | 30 |
| “disaster recovery”, “el ERP no levanta”, “runbook incidente”, “DB corrupta”, “host caído”, “restore en emergencia” | [disaster-recovery-pyme.md](30-playbooks/disaster-recovery-pyme.md) | 30 |
| “aggregator”, “features/orders”, “feature sin barrel root”, “hub de visualización”, “agregar varias entities” | [frontend-fsd.md#aggregator-pattern](10-architecture/frontend-fsd.md#aggregator-pattern-read-only-feature-without-root-barrel) | 10 |
| “créditos bancarios”, “préstamos”, “cuotas”, “amortización”, “UF”, “tarjeta de crédito estado/pago”, “cheques propios/girados”, “endoso”, “Centro de Bancos”, “roadmap bancos”, “pendientes de tesorería” | [50-audit/bancos/README.md](50-audit/bancos/README.md) | 50 |

## Global invariants (violate = PR rejected)

> Headline list. The **authoritative** rules live in [GOVERNANCE.md](90-governance/GOVERNANCE.md); the same 12 appear in the root [CLAUDE.md](../CLAUDE.md). Keep all three in sync.

1. **Zero `any`** — Zod-derived types or `unknown` + type guard. See [zero-any-policy.md](90-governance/zero-any-policy.md).
2. **No raw Tailwind colors** (`bg-red-500`) — semantic tokens only (`bg-primary`).
3. **No cross-feature internal imports** — feature barrel `index.ts` only.
4. **No direct `@/lib/api` in components or pages** — only `features/*/api/`, `features/*/hooks/`, `/hooks/`.
5. **No `useQuery`/`useMutation` directly in components** — wrap in a feature hook.
6. **Shared components imported via barrel only** — `@/components/shared`, never the file path.
7. **`StatusBadge`** is the only authorized status renderer.
8. **All shared components** handle `loading` / `empty` / `error` states.
9. **All forms** use `react-hook-form` + `zodResolver` (schema in `schema.ts`).
10. **Views ≤ 20 lines** per Django action — logic in `services.py`.
11. **Component suffix must match surface** — `Drawer` = slide-over, `Modal` = dialog, `Sheet`/`Wizard`/`Form`…; `FormModal`/`FormDrawer` are prohibited. See [naming-conventions.md](90-governance/naming-conventions.md).
12. **Changing a contract (layer 20), public API, or a global invariant requires an ADR.**

## Agentic model instructions

You are operating on ERPGrafico. Before any implementation:

- [ ] Matched intent in routing table above
- [ ] Read target playbook fully
- [ ] Read all preconditions listed in playbook frontmatter
- [ ] **UI Pre-flight:** Consulted `docs/20-contracts/component-decision-tree.md` to avoid re-inventing components.
- [ ] **Styling Pre-flight:** Read `frontend/app/globals.css` to verify available semantic color tokens.
- [ ] Verified invariants above are not violated by proposed change
- [ ] Ran validation commands listed in playbook

If no playbook matches, STOP. Ask user which intent applies or propose new playbook.

## Document lifecycle

- Every doc has frontmatter: `status`, `owner`, `last_review`.
- Stale if `last_review` > 6 months → CI warning.
- Contract docs (layer 20) cannot change without ADR.
