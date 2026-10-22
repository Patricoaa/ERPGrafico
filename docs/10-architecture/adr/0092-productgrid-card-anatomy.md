---
id: 0092
title: ProductGrid card anatomy — one card for POS, calculator and production, driven by a pure view-model
status: Accepted
date: 2026-10-21
author: frontend-team
---

# 0092 — ProductGrid card anatomy

**Related:** ADR-0076 (grid family lives in `components/selectors/ProductGridPicker`), `docs/20-contracts/component-selectors.md`, `docs/20-contracts/component-chip.md`, `docs/20-contracts/component-skeleton.md`

---

## Context

`ProductGrid` rendered each product with a square image, five copy-pasted availability pills floating over the picture, the name and price on one row, and a hover overlay with a large `+`. Code, unit and a visible action were missing, the selection ribbon used a CSS class (`ribbon-cmyk`) that was never defined, and POS / calculator differed only through an opaque `priceRenderer`. The design reference ("Una anatomía. Distintos contextos.") asks for one card whose code, name, availability and price always sit in the same place.

Two data gaps surfaced while planning: the product list endpoint ignores the `fields=` query the POS sends and returns a fixed serializer (`ProductListSerializer`), so the card could not know variant count, variant axis, cheapest variant price, BOM flags or manufacturable quantity.

## Decision

1. **Single card anatomy** (`ProductCard.tsx`): icon/photo strip with category chip, favourite, variant chip and selected check → mono code · name · availability line → price (c/IVA) with unit and an action glyph. Selected = `ribbon-cmyk` + primary (K100) ring + check; the ribbon also previews on hover/focus (`ribbon-cmyk-hover`); unavailable = muted card at 50 % opacity + lock + `–` + `cursor-not-allowed`. Dynamic pricing shows "Precio dinámico" instead of the amount; a template with zero active variants counts as unavailable.
2. **Pure view-model** (`product-card-model.ts`): `getProductCardModel(product, { limit, isDisabled })` decides availability text/tone, action glyph and price kind. No JSX; covered by vitest. Replaces the duplicated badge blocks.
3. **Public API of `ProductGrid` / `ProductGridPicker`** (invariant 12): adds optional `priceLabel`; `priceRenderer` keeps working and now may return `null` to hide the price block; `selectedProductIds` also drives the check and `aria-pressed`. No prop is removed.
4. **`ribbon-cmyk`** (4 px) and **`ribbon-cmyk-hover`** are defined as utilities in `globals.css` (C·M·Y plus K drawn with `--foreground` so it stays visible in dark mode).
5. **Backend**: `ProductListSerializer` exposes `variants_count`, `variant_axis_label`, `min_variant_price`, `has_bom`, `requires_advanced_manufacturing`, `mfg_auto_finalize`, `manufacturable_quantity`. Variant hints are derived from the existing `variants` prefetch of `list_products`; a test asserts the query count does not grow with the number of templates.
6. **Skeleton**: `CardSkeleton variant="product"` mirrors the new card (same strip height and rows).

## Consequences

- Cards are ~15 % shorter than the square-image version, so more products fit on screen (operator-speed criterion in DESIGN.md).
- A new product type or availability rule changes one function and its tests, not five JSX blocks.
- The list payload grows by a few scalar fields per product; the manufacturable quantity relies on the BOM prefetch already present in `list_products`.
- Not done (deliberately): a calculator-specific "Límite" semantic. `limits` keeps its current meaning (stock override); a limit that replaces stock in the calculator needs its own data source and is a follow-up.
