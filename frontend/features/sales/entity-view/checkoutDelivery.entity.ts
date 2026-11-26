import { defineEditable, defineEntity, type EditableChoice, type Eligibility } from "@/components/entity-view"
import type { SaleOrderLine } from "../types"

/**
 * Sales checkout, partial delivery (ADR-0087 P1): how much of each physical line ships now and in
 * which unit (`choice`). The step loads the allowed units and opens the numpad in touch mode (POS).
 */
export interface DeliveryCheckoutRow extends SaleOrderLine {
    key: string
    uomOptions: readonly EditableChoice[]
}

export const productIdOf = (l: SaleOrderLine): number | undefined => {
    const product = l.product && typeof l.product === "object" ? l.product.id : l.product ?? l.product_id
    return product === undefined || product === null || product === "" ? undefined : Number(product)
}
export const pendingOf = (l: SaleOrderLine) => l.qty || l.quantity || 0
const nameOf = (l: SaleOrderLine) => l.product_name || l.description

/** Manufacturing ships now only when it auto-finishes or is simple with enough stock + buildable units. */
export function deliveryEligibility(l: SaleOrderLine): Eligibility {
    const manufacturable = l.product_type === "MANUFACTURABLE" || Boolean(l.has_bom)
    if (!manufacturable || l.mfg_auto_finalize) return { ok: true }
    const simple = !l.requires_advanced_manufacturing
    const available = (l.qty_available || 0) + (l.manufacturable_quantity || 0)
    return simple && available >= pendingOf(l) ? { ok: true } : { ok: false, reason: "Requiere producción" }
}

export const deliveryCheckoutLineEntity = defineEntity<DeliveryCheckoutRow>()((f) => ({
    title: "Línea a despachar",
    rowId: (l) => l.key,
    fields: {
        product: f.text(nameOf, { label: "Producto" }),
        pending: f.quantity(pendingOf, { label: "Pendiente" }),
    },
}))

export const deliveryCheckoutEditable = defineEditable(deliveryCheckoutLineEntity, {
    rowKey: (l) => l.key,
    context: ["product", "pending"],
    inputs: {
        dispatch: {
            kind: "quantity",
            header: "A despachar",
            label: (l) => `Cantidad a despachar — ${nameOf(l)}`,
            max: pendingOf,
            step: () => 0.01,
        },
        uom: {
            kind: "choice",
            header: "Unidad",
            label: (l) => `Unidad — ${nameOf(l)}`,
            options: (l) => l.uomOptions,
            initialText: (l) => String(l.uom),
        },
    },
    eligible: deliveryEligibility,
    bulk: ["fillToMax", "clear"],
    bulkLabels: { fillToMax: "Despachar todo lo pendiente" },
})
