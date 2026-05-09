# ERPGrafico — Documentation Router

> Single entry point for agentic models and humans. Find your intent in the table, jump to the playbook. Do not skip preconditions.

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
| 20 | `20-contracts/` | Public APIs (components, hooks, endpoints, state) | Before consuming or exposing API |
| 30 | `30-playbooks/` | Step-by-step recipes for common tasks | Every implementation task |
| 40 | `40-quality/` | Testing, security, observability, performance, CI/CD | Cross-cutting concerns |
| 50 | `50-audit/` | Major refactor audits and roadmaps | Before launching multi-sprint refactor |
| 90 | `90-governance/` | Rules, policies, decision records | Before proposing deviation |

## Task Routing — intent → playbook

| Intent / Trigger phrases | Playbook | Layer |
|--------------------------|----------|-------|
| "new feature", "add module", "create entity CRUD" | [add-feature.md](30-playbooks/add-feature.md) | 30 |
| "new endpoint", "expose API", "REST route" | [add-endpoint.md](30-playbooks/add-endpoint.md) | 30 |
| "shared component", "promote to /shared", "reusable UI" | [add-shared-component.md](30-playbooks/add-shared-component.md) | 30 |
| "modify schema", "add field", "change Zod", "alter form" | [modify-schema.md](30-playbooks/modify-schema.md) | 30 |
| "migration", "alter table", "new model" | [add-migration.md](30-playbooks/add-migration.md) | 30 |
| "Celery task", "background job", "scheduled" | [add-background-task.md](30-playbooks/add-background-task.md) | 30 |
| "bug", "failing test", "unexpected behavior", "Celery task missing" | [debug-workflow.md](30-playbooks/debug-workflow.md) | 30 |
| "refactor", "extract", "rename" | [refactor-workflow.md](30-playbooks/refactor-workflow.md) | 30 |
| "deprecate", "remove feature", "sunset" | [deprecate-feature.md](30-playbooks/deprecate-feature.md) | 30 |
| "file upload", "attachment", "FileField", "MinIO", "document" | [add-file-upload.md](30-playbooks/add-file-upload.md) | 30 |
| "permission", "role", "access control", "RBAC", "guard" | [add-role-permission.md](30-playbooks/add-role-permission.md) | 30 |
| "selector", "N+1", "select_related", "prefetch_related", "slow query" | [add-selector.md](30-playbooks/add-selector.md) | 30 |
| "home server", "low resources", "old pc", "ssh development", "remote setup" | [home-server-setup.md](30-playbooks/home-server-setup.md) | 30 |
| "what is X", "domain term", "glossary" | [domain-glossary.md](00-context/domain-glossary.md) | 00 |
| "architecture", "folder structure", "where does X go" | [frontend-fsd.md](10-architecture/frontend-fsd.md) / [backend-apps.md](10-architecture/backend-apps.md) | 10 |
| "which component", "component decision", "what to use" | [component-decision-tree.md](20-contracts/component-decision-tree.md) | 20 |
| "Schema-driven form", "EntityForm", "backend form" | ~~[schema-driven-forms.md](20-contracts/schema-driven-forms.md)~~ — **superseded** por [ADR-0020](10-architecture/adr/0020-modal-on-list-edit-ux.md). No usar `EntityForm` en código nuevo. | 20 |
| "component API", "prop signature", "StatusBadge usage" | [component-contracts.md](20-contracts/component-contracts.md) | 20 |
| "selector component", "entity search", "combobox", "AccountSelector" | [component-selectors.md](20-contracts/component-selectors.md) | 20 |
| "module layout", "navigation pattern", "dynamic header", "module tabs" | [module-layout-navigation.md](20-contracts/module-layout-navigation.md) | 20 |
| "form size", "form pattern", "when to use tabs", "wizard vs form", "form surface", "form layout" | [component-form-patterns.md](20-contracts/component-form-patterns.md) | 20 |
| "edit modal", "list edit", "?selected param", "open modal from search", "detail from search" | [list-modal-edit-pattern.md](20-contracts/list-modal-edit-pattern.md) | 20 |
| "hook signature", "return shape" | [hook-contracts.md](20-contracts/hook-contracts.md) | 20 |
| "entity state", "status values" | [state-map.md](20-contracts/state-map.md) | 20 |
| "testing strategy", "coverage", "fixtures" | [testing.md](40-quality/testing.md) | 40 |
| "auth", "permissions", "injection", "security review" | [security.md](40-quality/security.md) | 40 |
| "logs", "metrics", "traces", "alerting" | [observability.md](40-quality/observability.md) | 40 |
| "slow", "optimize", "query N+1", "bundle size" | [performance.md](40-quality/performance.md) | 40 |
| "deploy", "pipeline", "CI failure" | [ci-cd.md](40-quality/ci-cd.md) | 40 |
| "any type", "TypeScript unknown", "type escape hatch" | [zero-any-policy.md](90-governance/zero-any-policy.md) | 90 |
| "versioning", "release process", "SemVer", "how to version" | [versioning-policy.md](90-governance/versioning-policy.md) | 90 |
| "ADR", "decision record", "major change" | [adr/README.md](10-architecture/adr/README.md) | 10 |
| "signals", "signal receiver", "post_save hook", "cross-app event" | [workflow-signals-registry.md](10-architecture/workflow-signals-registry.md) | 10 |
| "generic form", "universal registry", "metadata schema", "data-driven UI", "Django architecture refactor" | [50-audit/Arquitectura Django/README.md](50-audit/Arquitectura%20Django/README.md) | 50 |

## Global invariants (violate = PR rejected)

1. **Zero `any`** in TypeScript. Use Zod-derived types or `unknown` + guards.
2. **No raw Tailwind colors** (`bg-red-500`). Only semantic tokens.
3. **No cross-feature internal imports.** Use barrel exports.
4. **No direct `@/lib/api` in components.** Wrap in feature hook.
5. **`StatusBadge`** is the only authorized status renderer.
6. **All forms** use Zod + `react-hook-form` in `schema.ts`.
7. **All shared components** handle `loading` / `empty` / `error` states.
8. **Every public API change** requires ADR.

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
