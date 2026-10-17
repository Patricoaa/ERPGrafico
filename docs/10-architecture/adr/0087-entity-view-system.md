---
id: 0087
title: Entity view system — semantic entity definitions + per-surface composition (replaces createEntityFields / AutoEntityCard / DataTable authoring)
status: Accepted
date: 2026-10-17
accepted: 2026-10-17 (Gate C, spike validated — docs/50-audit/Tablascards/05-prototype-report.md)
author: frontend-team
supersedes: 0078; partially 0054, 0055, 0056, 0057, 0059, 0066, 0067 (marked as each entity migrates, Phase 7)
---

# 0087 — Entity view system

**Related:** audit `docs/50-audit/Tablascards/` (00–04), ADR-0028 (drawer registry), ADR-0072 (dead export removal precedent), ADR-0078 (DataTable façade split, *Proposed*), ADR-0080/0086 (DocumentRef, canonical navigation), contracts `component-fields.md`, `component-card.md`, `component-datatable-views.md`, `component-contracts.md#datacell-primitives`, `export-formats.md`, invariants #6 and #13.

> **Accepted at Gate C (2026-10-17)** after the spike (`components/entity-view/`, branch `spike/entity-view-system`) rebuilt UoM, products, sale orders (with lines and the editable delivery surface) and purchasing (orders/notes modes) with zero `computed`/`renderCard`/inline columns.

## Context

The audit of 2026-10-16/17 measured the current presentation system and found 8 structural causes of rigidity (`01-rigidity-forensics.md`):

1. Closed value-type union resolved by a core `switch`. Anything outside it goes to `computed`: 51 occurrences, 40 % of them document references.
2. Layout inferred from type → role → zone → capacity, plus regexes on key names. Escaping it takes 43 `placement: 'detail'` and 12 `fieldRole` overrides.
3. Card and table are coupled through `placement`, even for line lists that have no card.
4. Per-row card identity and wiring cannot be expressed. The result is 44 `renderCard` wrappers (931 lines).
5. The schema describes values, not the collection. That leads to about 52 inline columns, 14 of them duplicating existing fields.
6. `DataTable` is a monolith: 57 props, 21 of them with 0–1 consumers, plus 21 raw tables in wizards, modals and reports.
7. Presentation has several sources of truth: `*Fields`, `entity-registry` presentation keys, duplicated maps and unused view policies.
8. Weak typing and scattered formatting: one visible bug (TC-012), `as any`, `as unknown as`, and inline `Intl`.

Gate A (2026-10-17) approved these causes, the common/frequent/specific requirement matrix (`02`), the a11y/performance/typing constraints (`03`), and export as a requirement.

## Decision (proposed: alternative C of `04-architecture-options.md`)

1. **Entity definition per feature (`defineEntity<T>()`).**
   - Semantic fields with typed accessors (`keyof T`, or a function returning the value type of the kind).
   - Field ids form a literal union, used by every layout, `exclude`, column and export reference.
   - Also declared here: facets, the export hook and formats, and modes.
2. **Open value-kind registry.**
   - `interface ValueKinds` is extended by module augmentation.
   - Each kind provides a pure `format`, an optional `sortValue` and a `render`.
   - The core ships the common and frequent kinds (text, code, number, quantity, money, flow, date, dateRange, status, hubStatus, contact, tags, progress).
   - Features register their own kinds. Example: `docRef` in `features/documents`, which keeps FSD intact.
   - No opaque `computed`.
3. **Layout declared per surface.**
   - `views({ table, card, kanban })` with explicit column order and card slots (`media`, `title`, `subtitle`, `meta`, `trailing`, `body` sections, `footer`).
   - No role, regex or capacity inference. Semantics are shared across surfaces; layout is not.
4. **Headless collection + compound surfaces.**
   - `useEntityCollection` wraps TanStack Table and URL state.
   - `Collection.Root/Toolbar/View/Table/Grid/Footer/Empty` are small components, each under a prop ceiling.
   - Specific needs are composed (slots, or a feature-owned surface component that receives the typed model), never added as props.
5. **Editable surface.** `EditableCollection` sits on react-hook-form field arrays. It provides typed inputs with row-derived accessible names, per-row caps, rules and eligibility, footer totals and bulk helpers, for the wizard and modal patterns P1/P2.
6. **Accessibility by construction.**
   - A single semantic `<table>` with a sticky `thead`, plus `aria-sort` and `aria-busy`.
   - The default action is a real link or button. Cards have no nested interactive elements.
   - `role="table"` replaces `role="grid"` in compact mode (approved at Gate A).
7. **Identity stays in `entity-registry`** (label, icon, URL, drawer). Presentation keys (`viewPolicy`, `cardConfig`, `workflow`, `partnerField`) move to entity definitions.
8. **Export.**
   - The entity declares `export: { hook, formats }`, and the toolbar passes the current filters to that hook.
   - The backend renders the file per `export-formats.md`: one hook per export, no generic `useExport`.
9. **Governance.**
   - A kind enters the core only when ≥3 entities from ≥2 features use it.
   - Core components have at most 12 props, enforced by a contract test.
   - Lint forbids formatting outside formatters, ad hoc `<table>` in features, and migrated code importing the legacy system.
   - Type tests check invalid configurations.
10. **Adoption by strangler.**
    - The spike lives in `components/entity-view/` with its own barrel, on branch `spike/entity-view-system`.
    - The legacy system is frozen (props-compat test) and coexists with the new one.
    - `fromLegacyFields()` adapts schemas that have no `computed`.
    - Migration runs in batches of ≤5 entities. The legacy system is removed when it has zero consumers (ADR-0072 precedent).

### Adjustments from the spike (part of this decision)

- **A1 · Self-registering extensions.** A feature extension exports a field builder (e.g. `docRef(f, accessor, opts)`) that registers its kind when used, so no runtime bootstrap is needed and cross-feature use goes through the owning feature's barrel. Found by the onboarding test.
- **A2 · Typed entity label.** `label` becomes a union of `entity-registry` keys (today it is `string`, so an unregistered label compiles without icon, drawer or URL).
- **A3 · Labelled hub.** `hubStatus` requires a readable `caption` (StatusBadge text) shown before the axis rings; table and card share one status vocabulary (Gate C).
- **No native `min`/`max` on editable inputs.** HTML constraint validation blocks the react-hook-form submit; caps are shown as a hint and validated by the zod schema.
- **Footer totals group by resolved options** (unit, currency); mixed units are never added.

### Adoption prerequisites (first batch of Phase 7)

| ID | Change | Where |
|---|---|---|
| R1 | `align` prop and inline (`span`) rendering in `DataCell` | `components/shared/DataTableCells.tsx` |
| R2 | Single missing-value marker "—" (secondary tone) in `DataCell` | same |
| R3 | Explicit dense-surface escape from the Fitts min-height rule | `app/globals.css:766-769`, `components/ui/button.tsx` |
| R4 | `EntityCard`: accessible selection label + `EntityCard.Meta` slot | `components/shared/EntityCard.tsx` |
| R5 | `getHubStatuses` typed against a minimal structural interface | `lib/workflow-status.ts` |
| R6 | Contrast of warning/success intents (1.2:1 and 2.5:1 measured) — **separate color ADR** | color tokens |
| R7 | Typed collection context and cast-free registry | `components/entity-view` |
| R8 | Typed entity label (A2) | `lib/entity-registry.ts` |

### Phase 6 outcome (2026-10-17) — specification and contracts

- **Contract:** [`component-entity-view.md`](../../20-contracts/component-entity-view.md) is the layer-20 contract for new and migrated code. `component-fields.md` and `component-datatable-views.md` are frozen (their visual tokens and the `?view=` URL key are inherited). `component-card.md` is unaffected: it documents the shadcn `Card`, not the entity card. Full specification: `docs/50-audit/Tablascards/06-spec.md`.
- **Invariants:**
  - #6 is widened to the `@/components/entity-view` barrel. Module augmentation of `core/value-kinds` is the only allowed internal path.
  - #13 is rewritten as "entity collections declared once, composed per surface; legacy frozen".
  - "Zero N+1" becomes #14 in all three headline lists. It was #13 in `docs/README.md` only (a pre-existing desync).
  - GOVERNANCE §4.1 is rewritten (rules 24–26), and rule 23 now carries the value-kind governance bar.
- **Guards:**
  - `eslint-rules/entity-view-guards.mjs`: `no-legacy-presentation`, `no-adhoc-format`, `no-adhoc-table`, `no-deep-import`.
  - The cross-feature pattern `@/features/*/entity-view/*`.
  - `lib/__tests__/entity-view.contract.test.ts`: ≤12-prop ceiling, frozen core kind set, entity file location and no casts, legacy props-compat ceilings (`DataTableProps` 57, `DataTableViewProps` 12, `AutoEntityCardProps` 22, `FieldType` 15), and an ad hoc table ratchet (23 files).
- **A1 applied:** `docRef` is exported from the `@/features/documents` barrel.
- **Specified, not yet built (Phase 7 batch 1):** URL state (`useCollectionUrlState`), typed label (R8), cast-free context (R7), mounting `EntityViewProvider` in the app shell, and the `fromLegacyFields()` adapter.

## Consequences

### Positive
- The common case needs no custom code: about 29 pass-through `renderCard` and 43 placement overrides disappear.
- Specific needs live in the owning feature, with full typing.
- One formatter feeds table, card, subtitle and export, which makes format coherence enforceable.
- Invalid field references fail at compile time, so TC-012 can no longer happen.
- Wizard and modal tables get a shared, accessible contract.

### Negative
- Two systems coexist during migration.
- An adapter and lint guards are needed.
- Type-inference cost has to be measured (TY-7).
- Invariant #13 and the contracts `component-fields.md`, `component-card.md`, `component-datatable-views.md` and `component-contracts.md#datacell-primitives` must be rewritten (Phase 6).
- Invariant #6 may need widening if `@/components/entity-view` keeps its own barrel (decided at Gate C).

## Alternatives considered

- **A. Single declarative schema + one generic `<EntityCollection>`.** Scored 80/100. Rejected because it moves the 57-prop monolith into configuration keys (anti-goal 1) and leaves specific cases without a path.
- **B. Pure headless composition, with per-entity JSX tables and cards.** Scored 71/100. Rejected because it loses "declare fields once" and format coherence, and puts custom code in every common case.
- **ADR-0078: façade split of `DataTable`.** Scored 46/100. It addresses only cause 6, and its blocking assumption (no vitest) no longer holds. On acceptance it becomes *Superseded*; its props-compat test is reused to freeze the legacy API.

## References

- `docs/50-audit/Tablascards/00-system-map.md`, `01-rigidity-forensics.md`, `02-entity-needs.md`, `03-constraints-and-references.md`, `04-architecture-options.md`
- Diagram: `docs/50-audit/Tablascards/diagrams/alt-c-hybrid.html`
