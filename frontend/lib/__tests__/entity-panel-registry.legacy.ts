/**
 * Ratchet de ADR-0152: etiquetas con `<EntityPanelTab>` en la página cuyo drawer aún no está en
 * `ENTITY_DRAWERS`. Cada una se retira al registrar su drawer (Oleada 3 del plan
 * docs/superpowers/plans/2026-11-22-pestanas-de-registro-multiples.md). Solo se pueden quitar entradas.
 */
export const UNREGISTERED_PANEL_LABELS: string[] = [
    "accounting.budget",
    "inventory.inventorycount",
    "inventory.subscription",
    "inventory.uomcategory",
    "production.bom",
    "tax.taxperiod",
    "treasury.bank",
    "treasury.bankloan",
    "treasury.bankmovement",
    "treasury.cardpendingcharge",
    "treasury.paymentmethod",
]
