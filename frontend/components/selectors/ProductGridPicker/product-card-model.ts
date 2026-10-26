// Re-export: the product card view-model lives in the inventory feature (ADR-0097) so the catalog
// card (entity-view) and the POS ProductCard share one set of availability / price rules.
export { getAvailability, getPrice, getAction, getProductCardModel, pluralizeEs, variantChipLabel } from '@/features/inventory'
export type { AvailabilityTone, AvailabilityIcon, CardAction, CardAvailability, CardPrice, CardPriceKind, ProductCardContext, ProductCardModel } from '@/features/inventory'
