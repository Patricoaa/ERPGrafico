---
id: 0067
title: Entity Fields — placement surface reduction, header-last list order, zone-driven font-weight, numericFlow reintroduced
status: Accepted
date: 2026-08-03
author: core-team
---

# 0067 — Entity Fields: placement surface, header order, zone-driven weight, numericFlow

**Amends:** ADR-0066 (D-04 type surface; zone taxonomy), ADR-0057 (§zone hierarchy), ADR-0059 (§intra-zone; header zone position)
**Related:** ADR-0066 (discriminated-union FieldDef), ADR-0057 (Placement unified column order), ADR-0059 (toColumns mirrors card ordering), ADR-0062 (dateTime weights), `component-contracts.md` (DataCell primitives)

---

## Context

Post-ADR-0066 audit of the field engine surfaced four deltas between the declared contract and actual usage:

1. **`metric` / `footer` placement zones have zero producers.** No `*Fields.ts` file sets `placement: 'metric'` or `placement: 'footer'`, and no field uses `fieldRole: 'progress'`. The only path to those zones was cascade overflow in `toCardFields()` (never triggered). `AutoEntityCard.classifyFields` still renders `EntityCard.Metrics` / `EntityCard.Footer` from them, so two render paths exist for content nothing populates.
2. **List column order flattened the header zone.** `toColumns()` sorted `title → subtitle → header → detail`, so KPI columns (status, totals, flows, chips) landed in second position — visually identical weight to the subtitle, and the card's "header = distinctive KPIs" semantics were lost in the list.
3. **No font-weight hierarchy in lists.** Column cells default to `font-medium`; only the card had a visual hierarchy (semibold title/badges, bold footer/metrics). Title and header columns rendered as plain text in tables.
4. **`DataCell.NumericFlow` gained a real caller.** `stockMoveFields.quantity` is a `computed` with `fieldRole: 'flow'` that hand-rolls a `DataCell.NumericFlow` (deriving direction from the move's `IN`/`OUT` and attaching the UOM). This is exactly the shape of the `numericFlow` fieldtype ADR-0066 removed for zero uses.

## Decision

### D-01: Placement surface = what is used

`Placement` shrinks to `'title' | 'subtitle' | 'header' | 'detail'`.

- Remove `metric` / `footer` from the `Placement` union, from `ZONE_ORDER`, from `CAP` / `CASCADE_NEXT` (overflow chain becomes `title → subtitle → detail`, header overflow demoted to detail), and from `AutoEntityCard.classifyFields` + its JSX (`EntityCard.Metrics` / `EntityCard.Footer` blocks).
- Remove `FieldRole 'progress'` (no producers). `ROLE_TO_PLACEMENT` loses its `progress → metric` entry.
- `EntityCard.Metrics` / `EntityCard.Footer` **stay** as components for direct use (`BankCenterClientView`, `StatementsClientView`); only the placement-driven wiring is removed. The `overviewMetrics` path to `EntityCard.Metrics` in `AutoEntityCard` is preserved.

### D-02: Header zone sorts last in lists

`toColumns()` `ZONE_ORDER` becomes `title(0) → subtitle(1) → detail(2) → header(3)`. The header zone (status, totals, flows, chips) reads as the distinctive KPI block **before the actions column**. Intra-zone criteria are unchanged: subtitle follows `buildSubtitleOrder`, header follows `headerPriorityIndex`. The card layout is untouched — card zones are independent of column order.

### D-03: Zone-driven font-weight

Cells in the `title` and `header` zones render in `font-bold`; detail/subtitle keep `font-medium`.

- `renderCell(def, entity, opts?: { weight?: DataCellWeight })` threads a weight into the primitives that accept it (`Text`, `Code`, `Secondary`, `Date`, `Number`, `Currency`, `CurrencyFlow`, `NumericFlow`). `Status` / `Chip` / `Category` keep their badge typography. An explicit `def.weight` on a field wins over the auto-zone weight.
- `toColumns()` passes `weight: 'bold'` when the resolved zone is `title` or `header`; `toCardFields()` does the same per resolved placement; `resolveTitle()` always renders the card title bold.
- Card: `EntityCard` title wrapper bumps to `font-bold`; `AutoEntityCard` header trailing value span adds `font-bold`. The card center's existing `[&>*]:font-normal` keeps detail values normal.

### D-04: `numericFlow` fieldtype reintroduced

- New `FieldType 'numericFlow'` with options `direction?: FlowDirection | ((e) => FlowDirection)`, `unit?: string | ((e) => string)`, `showIcon?`, `showSign?`. Maps `TYPE_TO_ROLE['numericFlow'] = 'flow'` (→ header). Renders via `DataCell.NumericFlow` (direction optional → sign inference).
- `stockMoveFields.quantity` migrates from `computed` + `fieldRole: 'flow'` to `type: 'numericFlow'` (1:1 behavior: `get` = `Math.abs`, `direction` derived from `IN`/`OUT`, `unit` = UOM). The unused `DataCell` import is dropped.
- `BOMManager` keeps its direct `DataCell.NumericFlow` column (not a field definition) — unchanged.

## Consequences

### Positivas
- The placement contract again equals what is rendered; dead zones and the dead `progress` role are gone (one code path for card body content).
- Lists get a clear visual hierarchy (title/header KPIs bold) and header KPIs read last, adjacent to row actions — matching the card's "distinctive data" semantics.
- `numericFlow` restores a declarative, typed option surface for directional quantities; the hand-rolled `computed` pattern disappears.
- `weight` threading is additive and backward-compatible (no field change required; explicit `def.weight` wins).

### Negativas
- **Behavior change in every list**: header-zone columns move from position 2 to last; title/header cells change weight. Intended per this ADR.
- `Placement` / `FieldRole` / `renderCell` are layer-20 contracts — changed here with this ADR as authorization.
- Card variants that previously (theoretically) drained `metric`/`footer` now have no such route; those zones were unreachable in practice.

### Neutras
- `EntityCard.Metrics` / `EntityCard.Footer` remain as primitives for direct composition.
- `toColumns` / `toCardFields` / `resolveTitle` public signatures unchanged (weight is internal).

### Archivos modificados
- `frontend/components/shared/entity-fields.tsx` — Placement (4 zones), FieldRole (no `progress`), CAP/CASCADE_NEXT, ZONE_ORDER, `numericFlow` union member + `TYPE_TO_ROLE` + render case, `renderCell` weight param + callers
- `frontend/components/shared/AutoEntityCard.tsx` — `ClassifiedFields` / `classifyFields` without metric/footer; JSX drops Metrics/Footer blocks (keeps `overviewMetrics`); header value `font-bold`
- `frontend/components/shared/EntityCard.tsx` — title wrapper `font-bold`
- `frontend/features/inventory/stockMoveFields.tsx` — `quantity` → `numericFlow`
- `frontend/components/shared/__tests__/entity-fields.test.ts` — placement asserts, header-last ordering, metric removal
- Docs: ADR-0066 (revision pointer), ADR-0057, ADR-0059, ADR README index, `component-contracts.md`

## Alternatives considered

- **Keep `metric` / `footer` as reserved-but-unused zones:** rejected — contradicts ADR-0066's "surface = used" stance; dead zones imply render paths nothing exercises.
- **Keep header in position 2 and only bold title:** rejected — the list keeps treating KPIs as ordinary columns; the zone order change is the point.
- **Apply bold via CSS wrapper instead of `weight` threading:** rejected — `font-medium` on the primitive beats an inherited parent class; the weight must be threaded to the primitive.
- **Keep `numericFlow` as a hand-rolled `computed`:** rejected — the union contract says "one fieldtype = one renderer"; a real directional-quantity caller now exists.
- **Merge `chip` / `chip-category`:** considered and rejected — 8 single-value manual-intent vs 3 multi-value domain-resolved uses; a merged `domain?` prop reintroduces the silently-ignored-prop anti-pattern.

## References

- ADR-0066 — discriminated-union FieldDef (D-04 amended by D-04 here)
- ADR-0057 / ADR-0059 — placement column order (zone hierarchy amended by D-02 here)
- ADR-0062 — dateTime weights (weight threading builds on it)
- `docs/20-contracts/component-contracts.md` — DataCell primitives
- Implementación: `frontend/components/shared/entity-fields.tsx`
