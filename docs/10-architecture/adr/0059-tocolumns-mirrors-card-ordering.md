---
id: 0059
title: toColumns() mirrors card ordering — list subtitle & header follow card zones
status: Proposed
date: 2026-07-31
author: core-team
---

# 0059 — toColumns() mirrors card ordering

**Supersedes:** Part of ADR-0057 (Placement unified column order)
**Related:** ADR-0054 (Entity Fields Schema), ADR-0057 (Placement unified column order), ADR-0056 (Card Variant — Entity Registry SSOT)

---

## Context

ADR-0057 unified `order` and `cardPlacement` into a single `placement` zone, and `toColumns()` sorts exclusively by that zone. But two ordering criteria remained **card-only**:

1. **Subtitle auto-compose** (Priority 4): the card composes its subtitle from field roles in the order `name → relation → temporal → primary-value → explicit placement:'subtitle'` (up to 4 slots). In the list, the `subtitle` zone kept plain definition order, so the two surfaces disagreed. Example: `/accounting/entries?view=list` rendered the date second-to-last (definition order), while the card shows it as the first subtitle item.
2. **Header priority**: `AutoEntityCard.classifyFields` orders header fields as `complex → total/salary primary-value → primary-value → flow → tag`; the list's `header` zone ignored that and used definition order.

Both surfaces already shared the *zone* taxonomy; what was missing was a shared *intra-zone ordering* criterion.

## Decision

`toColumns()` must follow the **exact same intra-zone ordering criteria as the card**. The card's composition logic is promoted to a shared, exportable mechanism in `entity-fields.tsx`:

1. **`buildSubtitleOrder(defs, titleKeys, entity?)`** — single source of truth for subtitle composition. Data-aware for the card (`entity` provided → only non-null values) and **static** for the list (`entity` omitted → all candidates assumed present, keeping column order stable). Produces the ordered key list: `name → relation → temporal → primary-value → explicit subtitle`, capped at 4 slots.
   - `resolveSubtitle()` (card rendering, Priority 4) consumes it.
   - `toColumns()` consumes it to rank the `subtitle` zone.
   - `computeAutoComposeKeys()` is a thin Set-view wrapper over it (used by `getSubtitleExcludeKeys`).
2. **`headerPriorityIndex(role, key)`** — exported rank function for the header zone: `complex → 0`, total/salary `primary-value → 1`, other `primary-value → 2`, `flow → 3`, `tag → 4`, else `99`. `AutoEntityCard.classifyFields` and `toColumns()` both use it; the card's inline `HEADER_PRIORITY` map is removed.
3. Within `title`, `detail`, `metric`, `footer` zones the definition order is preserved (unchanged from ADR-0057).

Resulting column order for `/accounting/entries?view=list`: `Folio · Fecha · Estado · Origen · Total Débito · Descripción`.

## Consequences

### Positivas
- **List and card never disagree**: the same role-priority drives both subtitle and header ordering, so a field that reads first in the card subtitle also reads first in the table.
- **Single implementation**: the card's composition logic is now shared (`buildSubtitleOrder`), removing duplicated role-ordering code between `resolveSubtitle` and `toColumns`.
- **No per-entity config**: journal entries (and every entity) inherit the fix without touching `*Fields.ts`.

### Negativas
- **Behavior change in existing lists**: subtitle/header columns may reorder for any entity whose `toColumns()` has subtitle- or header-zone fields. This is the intended semantic order, consistent with the card.
- **Static vs data-aware**: the list assumes candidates are present (static mode), so a column can render even when the field is null for a given row (same as before; list rows are not evaluated per-row).

### Archivos modificados
- `frontend/components/shared/entity-fields.tsx` — `buildSubtitleOrder`, `headerPriorityIndex`, `toColumns()`, `resolveSubtitle()`, `computeAutoComposeKeys()`
- `frontend/components/shared/AutoEntityCard.tsx` — consumes `headerPriorityIndex`, removes inline `HEADER_PRIORITY`
- `frontend/components/shared/__tests__/entity-fields.test.ts` — column-ordering tests updated + new cases

## Alternatives considered

- **Local fix in `journalEntryFields.ts` only**: rejected — fixes one entity but leaves the mechanism inconsistent for every other list.
- **Reintroduce a numeric `order` property**: rejected — contradicts ADR-0057's single-source-of-truth decision.
- **Auto-detect subtitle by key-name heuristics in `toColumns()`**: rejected — duplicates the card logic instead of sharing it; drift-prone.
