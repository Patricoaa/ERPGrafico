import { defineEditable, defineEntity, type EditableChoice } from "@/components/entity-view"
import type { CheckoutLine } from "../types"

/**
 * Purchase checkout, receipt step (ADR-0087): how much of each line arrives now and in which unit
 * (`choice`), and the start date of each subscription (`date`, tax periods) — amendment 2026-11-26.
 */
export interface ReceiptCheckoutRow extends CheckoutLine {
    key: string
    uomOptions: readonly EditableChoice[]
}

const nameOf = (l: CheckoutLine) => l.product_name || l.name || l.description || ""
export const orderedOf = (l: CheckoutLine) => l.quantity || l.qty || 0
/** Subscription dates are keyed by product (as the checkout payload expects). */
export const subscriptionKeyOf = (l: CheckoutLine) => String(l.product || l.id)

export const receiptCheckoutLineEntity = defineEntity<ReceiptCheckoutRow>()((f) => ({
    title: "Línea a recibir",
    rowId: (l) => l.key,
    fields: {
        product: f.text(nameOf, { label: "Producto" }),
        subscription: f.text(nameOf, { label: "Suscripción" }),
        ordered: f.quantity(orderedOf, { label: "Ordenado" }),
    },
}))

export const receiptQuantitiesEditable = defineEditable(receiptCheckoutLineEntity, {
    rowKey: (l) => l.key,
    context: ["product", "ordered"],
    inputs: {
        received: {
            kind: "quantity",
            header: "A recibir",
            label: (l) => `Cantidad a recibir — ${nameOf(l)}`,
            max: orderedOf,
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
    bulk: ["fillToMax", "clear"],
    bulkLabels: { fillToMax: "Recibir todo lo ordenado" },
})

export const subscriptionStartEditable = defineEditable(receiptCheckoutLineEntity, {
    rowKey: (l) => l.key,
    context: ["subscription"],
    inputs: {
        start: {
            kind: "date",
            header: "Fecha de inicio",
            label: (l) => `Fecha de inicio — ${nameOf(l)}`,
            validation: "tax",
            required: true,
        },
    },
})
