---
id: 0072
title: Removal of dead shared exports (EntityHeader, CardActions, EntityCard.Hero, dead DataCell props)
status: Accepted
date: 2026-09-17
author: frontend-team
---

# 0072 — Removal of dead shared exports (EntityHeader, CardActions, EntityCard.Hero, dead DataCell props)

**Related:** ADR-0020 (modal-on-list edit UX), ADR-0064, `docs/50-audit/design-system-ui-audit.md` (§6, §7, T1), `deprecate-feature.md`

---

## Context

The design-system audit (§6) verified four pieces of dead code in `components/shared` with **0 consumers outside the barrel**:

| Artifact | Size | Notes |
|----------|------|-------|
| `EntityHeader.tsx` | 153 L | Detail-page header for `[id]/page.tsx` routes — those routes were reverted to list-modal-edit by ADR-0020 |
| `CardActions.tsx` | 73 L | Card/kanban wrapper around `DataCell.ActionGroup`; kanban never adopted it |
| `EntityCard.Hero` (+ `EntityCardHeroProps`) | ~28 L | Speculative subcomponent; no consumer |
| `DataTableCells` props `textTransform` / `letterSpacing` (+ `TEXT_TRANSFORM_MAP` / `LETTER_SPACING_MAP`) | ~16 L | No call site ever passed them |

`EntityHeader` and `CardActions` are exported from the public barrel (`@/components/shared`) and documented in Layer-20 contracts (`entity-identity.md` §6, `component-row-actions.md` §5.2, `component-contracts.md`). Removing them is therefore a **public-API / Layer-20 contract change** and requires an ADR under invariant 12. The audit's governance table (§7) had marked T1 "no ADR"; that row is corrected by this ADR.

Evidence (2026-09-17): repo-wide grep for each symbol returns only its own definition and the barrel export — no feature, page, hook or test consumes them.

## Decision

1. **Delete** `components/shared/EntityHeader.tsx`, `components/shared/CardActions.tsx`, the `EntityCard.Hero` subcomponent and `EntityCardHeroProps`, and the `textTransform` / `letterSpacing` props (with their maps and types) from `DataTableCells.tsx`.
2. **Remove** their barrel exports from `components/shared/index.ts` so the public surface shrinks.
3. **Update the contracts** to drop the removed entries and, where useful, point at the surviving primitives:
   - `entity-identity.md` §6 → historical "eliminado" pointer (same pattern as §7 `EntityDetailPage`); identity in drawers/modals is rendered with `EntityBadge` / `DataCell.Entity`.
   - `component-row-actions.md` §5.2 and its surface map → card/kanban actions use `DataCell.ActionGroup` + `DataCell.Action` / `DataCell.ActionMenu` directly.
   - `component-contracts.md` → drop the `CardActions` row.
4. **No deprecation window**: these are internal, unreleased, zero-consumer surfaces; a `@deprecated` period would keep dead code alive without a consumer to migrate. `deprecate-feature.md`'s removal gates are satisfied (zero usage, no open issues, no external API).

## Consequences

### Positivas
- The shared barrel only publishes components with real consumers (audit §8.0 / §10 rule: barrel publishes ≥3 consumers), shrinking the public surface and the bundle.
- Two Layer-20 contract sections stop advertising components that no code can use.
- The `DataTableCells` prop surface loses two never-used knobs (relevant to the T8 prop-count goal).

### Negativas
- A future card/kanban surface that wanted the `CardActions` wrapper must build on `DataCell.ActionGroup` directly (the wrapper's stated purpose — card-only visual tweaks — moves to the caller).
- Any external fork pinned to these exports would break; none is known in-repo.

### Archivos modificados
- Deleted: `frontend/components/shared/EntityHeader.tsx`, `frontend/components/shared/CardActions.tsx`
- Edited: `frontend/components/shared/EntityCard.tsx`, `frontend/components/shared/DataTableCells.tsx`, `frontend/components/shared/index.ts`
- Docs: `docs/20-contracts/entity-identity.md`, `docs/20-contracts/component-row-actions.md`, `docs/20-contracts/component-contracts.md`, `docs/50-audit/design-system-ui-audit.md` (§7 row + T1)

## Alternatives considered

- **Keep them deprecated with a console warning** (`deprecate-feature.md` Phase 2): rejected — a deprecation window is for consumers that still exist; here there are none, so the warning would never fire and the code would linger.
- **Keep `CardActions` as the documented card surface**: rejected — it is dead and duplicates `DataCell.ActionGroup`; the contract should document the primitive that is actually used.
- **Keep `EntityHeader` for a hypothetical return of `[id]` detail pages**: rejected — ADR-0020 deliberately reverted that route convention; re-adding it would need a new ADR anyway.

## References

- `docs/50-audit/design-system-ui-audit.md` — §6 dead code, §7 governance table, T1
- `docs/30-playbooks/deprecate-feature.md`
- `docs/20-contracts/entity-identity.md` (§6, §7 precedent), `docs/20-contracts/component-row-actions.md` (§1, §5.2), `docs/20-contracts/component-contracts.md`
- `docs/90-governance/GOVERNANCE.md` §12
