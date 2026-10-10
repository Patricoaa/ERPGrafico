---
id: 0078
title: DataTable family façade-first split (56-prop surface distilled behind a stable API)
status: Proposed
date: 2026-10-09
author: frontend-team
deferred: 2026-10-09 — product owner did not approve yet; implementation parked until vitest/CI (Node ≥20.12) can run the 56-prop compat test. Re-open by approving this ADR.
---

# 0078 — DataTable family façade-first split

**Related:** `docs/50-audit/design-system-ui-audit.md` (§8 family refactor, T8), ADR-0066/0067 (discriminated-union surface reduction precedent), ADR-0072 (dead shared exports removal), `docs/20-contracts/component-datatable-views.md`, `docs/50-audit/design-system-ui-audit.md` §4.5

---

## Context

The `DataTable` family is the largest public surface in `components/shared`. Verified against the current tree on 2026-10-09:

| File | Lines | Public props | Notes |
|---|---|---|---|
| `DataTable.tsx` | 996 | `DataTableProps` = **56** | god-component: tanstack core + toolbar + pagination + view switching + bulk dock + analytics + expandable + column toggle + variants + footer + filters |
| `DataTableCells.tsx` | 1003 | — | cell library (`DataCell.*`, column headers, expand headers) |
| `DataTableToolbar.tsx` | 299 | — | |
| `GenericWizard.tsx` | 321 | 16 (+`BaseModalProps`) | wizard shell |
| `ActionDock.tsx` | 166 | — | **hosts the only `MutationObserver` in the family** (`ActionDock.tsx:33`) |

**Blast radius (measured):**
- **139 external consumers** via the shared barrel (the barrel is the *sole* entry point; zero direct-path imports outside `shared/`) + **6 internal shared consumers** (`DataTableView`, `DataTableCells`, `DataTableToolbar`, `DataTable`, `entity-actions`, `entity-fields`).
- Family = 12 of the 107 `export *` lines of `components/shared/index.ts`.
- **Contract-test pins** (a split must keep green or update deliberately):
  1. `lib/__tests__/animate-in.contract.test.ts` ratchet allowlist lists `ActionDock.tsx`, `DataTableCells.tsx`, `GenericWizard.tsx` (+ family consumers). Constraint: do **not** add inline `animate-in/out` utilities; migrate to `FadeIn`.
  2. `lib/__tests__/semantic-ink.test.ts` pins the **file path** `components/shared/DataTableCells.tsx` in its Layer-1 ink allowlist.
- **No unit tests import family symbols** (no vitest coverage of internals to break).

The audit ceiling ("core ≤15 props", invariant 6/12) cannot be reached by amputating the 56-prop interface while 139 real consumers exist. And this environment cannot run vitest (Node 18.19.1, rolldown needs `node:util.styleText`), so a behavior-churning rewrite would be unverified.

## Decision

**Façade-first split.** Keep every public symbol and file path byte-for-byte compatible; distill the *internals* behind the same API.

1. **New compact core `DataTableCore` (new file, ≤15 props)** owning the table primitive: `columns`, `data`, `variant`, `density`, plus state wiring via an explicit discriminated-union config (the ADR-0066/0067 pattern, not a flat prop grab-bag). All *reading* concerns (columns visibility, filters, pagination, view) become explicit props on a config object, keeping the prop count flat.
2. **`DataTable` becomes a thin compat façade** (same file, same 56-prop `DataTableProps`, deprecated marker as in ADR-0072) that maps its 56 props onto `DataTableCore` + leaf handlers. Reduces `DataTable.tsx` from ~996 L to a façade (~150–200 L) without touching any of the 139 consumers.
3. **Hoist leaf surfaces of `DataTable`** (`DataTableLoading`, `DataTableEmpty`, compact row/empty variants) into their own files so `DataTableCore` owns only the table; loading/empty/error shells become composition.
4. **ActionDock: remove the `MutationObserver`** (replace `updateStates` DOM-watch with callback/context-driven state), keeping the `ActionDock.tsx` path (pinned). No new `animate-in/out` utilities — `FadeIn` only (existing migration pattern: `PartnerContributionWizard`, `SessionOpenModal`, etc.).
5. **`DataTableCells.tsx` keeps its filename as a thin re-export** if internals are ever split; the `semantic-ink` allowlist entry stays valid. Split cell bodies only where extraction is type-driven by `entity-fields` (ADR-0066/0067); do not split for its own sake (1003 L of a *cell registry* is acceptable; it is not a god-authoring surface).
6. **Barrel unchanged:** the 12 `export *` lines stay (public API stable). Internal family files import each other **relatively** (barrel is the external entry only — same invariant enforced by ADR-0076/0072). If inline `animate-in/out` remains in family files after this ADR, that's a separate cleanup, not part of this split.
7. **Props-compat contract test** (new, vitest): snapshot the 56 public `DataTableProps` keys + the exported symbol set pre/post split; assert façade delegates to core. This test is what un-doors future reduction. **Execution of the code split is gated on CI/vitest availability** (Node ≥20.12); the ADR is the reviewable artifact now.

## Consequences

### Positivas
- 139 consumers untouched; public API frozen (barrel + symbols + paths), so no migration wave.
- God-component authoring surface eliminated at the source: future changes happen in `DataTableCore` (≤15 props) or in leaves, not in a 56-prop if-tree.
- Removes the last `MutationObserver` in the family (simplifies react inspect/debugging).
- Sets the verification hook (props-compat test) that permits the audit's "core ≤15 props" invariant to *finally* be enforced mechanically.

### Negativas
- `DataTable` façade temporarily duplicates prop mapping (bridge code) — small, mechanical, and the cost of not breaking 139 call sites.
- Two-step work: core split first (gated), then per-module migration off the façade (future, optional).
- `DataTableCore` with a discriminated-union config is a new architectural surface that needs review discipline to avoid recreating a 56-prop config.

## Alternatives considered

- **Amputate the 56-prop surface now** (drop props, migrate consumers): rejected — 139 call sites, property-by-property churn, unverifiable here (no vitest), and contradicts "don't ship unverified behavior".
- **Extract one concern per PR (toolbar, pagination, bulk…) without a core**: partial interim step, but leaves `DataTable.tsx` as the growing hub and never satisfies the invariant; adopted only as fallback if core extraction stalls.
- **New component name + codemod** (`DataTableCore` public, wrapper in each module): rejected — churns 139 imports for no compat gain; façade inside the same file is the smaller diff.

## References

- Evidence: `frontend/components/shared/DataTable.tsx` (props 35–141 = 56), `DataTableCells.tsx` 1003L, `GenericWizard.tsx` 321L/16 props, `ActionDock.tsx:33` (MutationObserver).
- `frontend/lib/__tests__/animate-in.contract.test.ts` (lines 29/33/39) y `frontend/lib/__tests__/semantic-ink.test.ts` (line 19) — pins conservados.
- Barrel: `frontend/components/shared/index.ts` (12 de 107 líneas de export de la familia).
- T8 en `docs/50-audit/design-system-ui-audit.md` (§ incidencia), §4.5 (estados LOADING/EMPTY que deben exponer las hojas).