import { defineEditable, type EditableInput, type EditableRowValue } from "@/components/entity-view"
import type { OrderLine } from "../types"
import { amount, lineQty, linePending, nameOf, orderLineEntity, uomOf } from "./orderLine.entity"

/*
 * P1 "quantity to process per line" over the shared line entity (ADR-0087 lote 3a): dispatch (sales)
 * and receipt/return (purchasing). They live next to `orderLineEntity` because a definition built at
 * module level in another feature would read it through the `@/features/orders` barrel while an import
 * cycle is still evaluating it (TDZ). Consumers read them at call time (schema, render), never at module level.
 */

const step = (l: OrderLine) => (l.uom_name === "Unidad" ? 1 : 0.01)
const unit = (l: OrderLine) => uomOf(l) ?? undefined

// ─── Dispatch (DeliveryDrawer) ───────────────────────────────────────────────
/** Both dispatch modes share one input shape, so a form picks either without a union of literal types. */
type DeliveryInputs = { toDeliver: EditableInput<OrderLine> }

/** Advanced manufacturing ships only once its work order is finished. */
function eligible(l: OrderLine) {
    if (l.product_type === "MANUFACTURABLE" && l.requires_advanced_manufacturing && !l.is_production_finished) {
        return { ok: false as const, reason: "Producción pendiente (la OT debe estar terminada)" }
    }
    return { ok: true as const }
}

/** What the warehouse can ship besides the pending cap (same rules as the server dispatch). */
function stockCheck(l: OrderLine, value: number): string | undefined {
    // Advanced manufacturing ships against its finished work order, not warehouse stock (as before).
    if (l.requires_advanced_manufacturing) return undefined
    if (l.product_type === "MANUFACTURABLE" && !l.requires_advanced_manufacturing && !l.track_inventory) {
        const can = l.manufacturable_quantity ?? 0
        return value > can ? `Stock de componentes insuficiente (máx. ${amount(can)})` : undefined
    }
    // Unknown stock (still loading) is not "0 available": the form waits for it before submitting.
    if (l.track_inventory && l.available_stock !== undefined) {
        const available = l.available_stock
        return value > available ? `Stock insuficiente (${amount(available)} disponibles)` : undefined
    }
    return undefined
}

const toDeliver = (header: string, verb: string) => ({
    kind: "quantity" as const,
    header,
    label: (l: OrderLine) => `${verb} — ${nameOf(l)}`,
    max: (l: OrderLine) => Math.max(0, linePending(l)),
    step,
    initial: (l: OrderLine) => Math.max(0, linePending(l)),
    unit,
})

const rowStatus = (complete: string, partial: string) => (l: OrderLine, v: { toDeliver: number }) => {
    if (v.toDeliver <= 0) return null
    return v.toDeliver >= linePending(l)
        ? { status: "delivered", label: complete, intent: "success" as const }
        : { status: "partial", label: partial, intent: "warning" as const }
}

/** P1 "quantity to dispatch" of `DeliveryDrawer` (lote 3a). The rows carry `available_stock` of the chosen warehouse. */
export const deliveryLinesEditable = defineEditable<OrderLine, typeof orderLineEntity.fields, DeliveryInputs>(orderLineEntity, {
    rowKey: (l) => l.id,
    context: ["description", "pending", "availability"],
    inputs: { toDeliver: { ...toDeliver("A despachar", "Cantidad a despachar"), check: stockCheck } },
    eligible,
    rowStatus: rowStatus("Despacho completo", "Despacho parcial"),
    footer: { sum: ["toDeliver"] },
    bulk: ["fillToMax", "clear"],
    bulkLabels: { fillToMax: "Despachar todo lo pendiente" },
})

/** Service delivery: no warehouse, no stock column. */
export const serviceDeliveryLinesEditable = defineEditable<OrderLine, typeof orderLineEntity.fields, DeliveryInputs>(orderLineEntity, {
    rowKey: (l) => l.id,
    context: ["description", "pending"],
    inputs: { toDeliver: toDeliver("A entregar", "Cantidad a entregar") },
    rowStatus: rowStatus("Entrega completa", "Entrega parcial"),
    footer: { sum: ["toDeliver"] },
    bulk: ["fillToMax", "clear"],
    bulkLabels: { fillToMax: "Entregar todo lo pendiente" },
})

/** Line ids → quantity for `dispatch_partial` (only lines with something to ship). */
export function toLineQuantities(lines: readonly { key: string; values: Record<string, number> }[]): Record<string, number> {
    return Object.fromEntries(lines.filter((l) => (l.values.toDeliver ?? 0) > 0).map((l) => [l.key, l.values.toDeliver]))
}

// ─── Receipt / return (ReceiptModal) ─────────────────────────────────────────
/** Receipt and return share one input shape, so a form picks either without a union of literal types. */
type ReceiptInputs = { quantity: EditableInput<OrderLine>; unitCost: EditableInput<OrderLine> }

/** Unit cost of the receipt: starts at the ordered cost, unrounded (it used to be rounded up with `Math.ceil`). */
const unitCost = {
    kind: "money" as const,
    header: "Costo (unit.)",
    label: (l: OrderLine) => `Costo unitario — ${nameOf(l)}`,
    step: () => 0.01,
    initial: (l: OrderLine) => lineQty(l.unit_cost),
}

/**
 * P1 "quantity to receive" of `ReceiptModal` (lote 3a). There is no cap: the server accepts
 * receiving more than ordered (the supplier sent more), so "Excede pendiente" is a row status, not an error.
 */
export const receiptLinesEditable = defineEditable<OrderLine, typeof orderLineEntity.fields, ReceiptInputs>(orderLineEntity, {
    rowKey: (l) => l.id,
    context: ["description", "pending", "unitCost"],
    inputs: {
        quantity: {
            kind: "quantity",
            header: "A recibir",
            label: (l) => `Cantidad a recibir — ${nameOf(l)}`,
            step,
            initial: (l) => Math.max(0, linePending(l)),
            unit,
        },
        unitCost,
    },
    processed: ["quantity"],
    rowStatus: (l, v) => {
        if (v.quantity <= 0) return null
        const pending = linePending(l)
        if (v.quantity > pending) return { status: "exceeded", label: "Excede pendiente", intent: "destructive" }
        return v.quantity === pending
            ? { status: "received", label: "Completo", intent: "success" }
            : { status: "partial", label: "Parcial", intent: "warning" }
    },
    bulk: ["clear"],
    footer: { sum: ["quantity"] },
})

/** Return to the supplier: capped by what was received, nothing proposed. */
export const returnLinesEditable = defineEditable<OrderLine, typeof orderLineEntity.fields, ReceiptInputs>(orderLineEntity, {
    rowKey: (l) => l.id,
    context: ["description", "receivedQty", "unitCost"],
    inputs: {
        quantity: {
            kind: "quantity",
            header: "A devolver",
            label: (l) => `Cantidad a devolver — ${nameOf(l)}`,
            max: (l) => Math.max(0, lineQty(l.quantity_received ?? l.received_quantity)),
            step,
            unit,
        },
        unitCost,
    },
    processed: ["quantity"],
    bulk: ["fillToMax", "clear"],
    bulkLabels: { fillToMax: "Devolver todo lo recibido" },
    footer: { sum: ["quantity"] },
})

/** `line_data` of `partial_receive` / `partial_return` (only lines with a quantity). */
export function toReceiptLineData(lines: readonly { key: string; values: Record<string, number> }[], rows: readonly OrderLine[]) {
    const byId = new Map(rows.map((r) => [String(r.id), r]))
    return lines
        .filter((l) => (l.values.quantity ?? 0) > 0)
        .map((l) => ({
            line_id: Number(l.key),
            quantity: l.values.quantity,
            unit_cost: l.values.unitCost ?? lineQty(byId.get(l.key)?.unit_cost),
        }))
}

/** Some line is processed below its pending quantity (the form warns "despacho/recepción parcial"). */
export function hasPartialLines(value: readonly EditableRowValue[], rows: readonly OrderLine[], input: string): boolean {
    const pendingById = new Map(rows.map((r) => [String(r.id), linePending(r)]))
    return value.some((v) => {
        const pending = pendingById.get(v.key)
        return pending !== undefined && (v.values[input] ?? 0) < pending
    })
}
