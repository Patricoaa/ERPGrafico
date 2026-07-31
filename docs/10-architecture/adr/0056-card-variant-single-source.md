---
id: 0056
title: Card Variant — Entity Registry as Single Source of Truth
status: Accepted
date: 2026-07-19
author: core-team
---

# 0056 — Card Variant: Entity Registry as Single Source of Truth

**Related:** component-datatable-views.md, component-skeleton.md, entity-identity.md

---

## Context

The card view loading skeleton (`EntityCard.Skeleton`) and the actual card (`AutoEntityCard`) derive their variant independently:

- **Skeleton**: `DataTableView.internalLoadingView` reads `policy?.cardVariant` from `ENTITY_REGISTRY`
- **Card**: `AutoEntityCard` receives `variant` prop from the consumer's `renderCard` callback, defaulting to `'full'`

Two bugs compound:

1. **Dead code in AutoEntityCard** (`AutoEntityCard.tsx:265`): `variant = 'full'` in destructuring means the registry fallback (`variant ?? registryVariant ?? 'full'`) never executes — `'full'` is always resolved before the nullish coalescing chain.

2. **Missing `cardVariant` in registry**: Only 5 of 51 entities with `cardComponent: 'entity'` declare `cardVariant`. The other 46 implicitly default to `'full'` in `createCardLoadingView`, regardless of what variant the consumer actually passes to `AutoEntityCard`.

**Impact**: 14 entities with `highlights` or `summary` variants render a full-height skeleton (~100px) but a compact card (~50px), causing visible CLS on every card view load. `accounting.journalentry` has the inverse problem: skeleton is compact (reads `'highlights'` from registry) but card renders full (dead code defaults to `'full'`).

## Decision

Make `ENTITY_REGISTRY[label].viewPolicy.cardVariant` the **single source of truth** for both skeleton and card variant.

### D-01: Remove default from AutoEntityCard variant prop

```ts
// BEFORE (line 265)
variant = 'full',

// AFTER
variant,
```

When `variant` is `undefined`, the fallback chain `variant ?? registryVariant ?? 'full'` correctly reads from the entity registry. Consumers that pass an explicit `variant` are unaffected (explicit prop takes priority).

### D-02: Populate `cardVariant` on all entity registry entries

Add `cardVariant` to every `viewPolicy` entry with `cardComponent: 'entity'`. Values derived from the actual `renderCard` callback in each feature's `*ClientView.tsx`:

| Variant | Entities |
|---------|----------|
| `'workflow'` | saleorder, purchaseorder, invoice (already defined) |
| `'highlights'` | contact, partner, warehouse, category, uom, uomcategory, pricingrule, budget, salaryadvance, absence, group, journalentry |
| `'summary'` | bankloan, taxperiod |
| `'full'` | stockmove, All remaining entities |

### D-03: Remove redundant `variant` prop from consumers

After D-02, the explicit `variant="..."` on each `<AutoEntityCard>` is redundant (registry already declares it). Remove from all 43 call sites to avoid dual source of truth.

**Exception**: `accounting.journalentry` (`EntriesClientView.tsx:157`) already omits `variant` — no change needed.

## Consequences

### Positive

- **Single source of truth**: entity registry drives both skeleton and card — one place to maintain
- **Zero CLS**: skeleton geometry always matches card geometry
- **Dead code eliminated**: `registryVariant` fallback in AutoEntityCard actually executes
- **Future-proof**: new entities that omit `variant` in `renderCard` automatically get the correct skeleton via registry
- **Aligned with entity-identity.md**: reinforces "ENTITY_REGISTRY is the only source of truth"

### Negative

- **44 consumer files touched**: mechanical removal of `variant` prop (low risk, high churn)
- **Registry bloat**: 41 new `cardVariant` entries (cosmetic, no runtime cost)

### Neutral

- **ADR required**: contract change on AutoEntityCard (layer 20) per GOVERNANCE §12
- **Backward compatible**: consumers that pass explicit `variant` still work (prop priority unchanged)

## Verification

1. `npm run type-check` passes
2. `npm run lint` passes
3. Manual: `/contacts?view=card` shows compact skeleton → compact card
4. Manual: `/sales/orders?view=card` shows workflow skeleton → workflow card
5. Manual: `/accounting/entries?view=card` shows compact skeleton → compact card (was full before)
