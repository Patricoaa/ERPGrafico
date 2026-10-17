import { defineEditable, defineEntity, toNumber } from "@/components/entity-view"
import { docRef } from "@/features/documents"
import type { OrderLine } from "../types"

const qty = (v: number | string | null | undefined): number => toNumber(v) ?? 0

/**
 * Order lines in the document sheet. `OrderLine` has an index signature, so every
 * field uses a typed accessor function (keys of an indexed type are not narrowed).
 * References use the documents extension builder `docRef(f, …)`, which registers its kind.
 */
export const orderLineEntity = defineEntity<OrderLine>()((f) => ({
    label: "sales.saleline",
    fields: {
        product: docRef(f, (l) => (l.product ? { label: "inventory.product", id: l.product, display: l.product_name ?? `#${l.product}` } : null), { label: "Producto" }),
        description: f.text((l) => l.product_name ?? l.description ?? null, { label: "Descripción" }),
        quantity: f.quantity((l) => l.quantity, { label: "Cantidad", uom: (l) => l.uom_name ?? l.unit_name ?? null }),
        unitPrice: f.money((l) => l.unit_price_net ?? l.price_unit, { label: "Precio unit. (neto)" }),
        delivered: f.progress(
            (l) => ({ done: qty(l.quantity_delivered ?? l.quantity_received ?? l.delivered_quantity ?? l.received_quantity), total: qty(l.quantity) }),
            { label: "Entregado", format: "ratio" },
        ),
        pending: f.quantity(
            (l) => qty(l.quantity) - qty(l.quantity_delivered ?? l.quantity_received),
            { label: "Pendiente", uom: (l) => l.uom_name ?? l.unit_name ?? null },
        ),
        workOrder: docRef(
            f,
            (l) => {
                const wo = l.work_order_summary
                if (!wo?.id) return null
                return { label: "production.workorder", id: Number(wo.id), display: String(wo.display_id ?? wo.number ?? `OT-${wo.id}`) }
            },
            { label: "OT" },
        ),
        subtotal: f.money((l) => l.subtotal_net ?? l.subtotal, { label: "Subtotal (neto)" }),
    },
}))

const lineTable = orderLineEntity.views({
    table: { columns: ["product", "quantity", "unitPrice", "delivered", "workOrder", "subtotal"], footer: { sum: ["subtotal"] } },
}).table

export const orderLineViews = {
    sale: lineTable,
    // OC has no OT column. `without("work_order_summary")` would not compile (TC-012).
    purchase: lineTable.without("workOrder"),
}

/** P1 "quantity to process per line" (DeliveryDrawer, Step3_Delivery…) as a declared editable surface. */
export const deliveryLinesEditable = defineEditable(orderLineEntity, {
    rowKey: (l) => l.id,
    context: ["description", "quantity", "pending"],
    inputs: {
        toDeliver: {
            kind: "quantity",
            header: "A despachar",
            label: (l) => `Cantidad a despachar — ${l.product_name ?? l.description ?? `línea ${l.id}`}`,
            max: (l) => Math.max(0, qty(l.quantity) - qty(l.quantity_delivered)),
            step: (l) => (l.uom_name === "Unidad" ? 1 : 0.01),
            initial: (l) => Math.max(0, qty(l.quantity) - qty(l.quantity_delivered)),
            unit: (l) => l.uom_name ?? l.unit_name,
        },
    },
    eligible: (l) => (l.requires_advanced_manufacturing && !l.work_order_summary ? { ok: false, reason: "Requiere producción" } : { ok: true }),
    footer: { sum: ["toDeliver"] },
    bulk: ["fillToMax", "clear"],
    bulkLabels: { fillToMax: "Despachar todo lo pendiente" },
})
