import { defineEditable, defineEntity, type EditableChoice, type Eligibility } from "@/components/entity-view"
import type { NoteLineItem } from "../types"

/**
 * P1 "quantity to dispatch / receive now" of a note's partial logistics (ADR-0087), with the unit of
 * the line as a `choice` input (amendment 2026-11-26). The rows carry their allowed units, loaded by
 * the step through `useAllowedUoMsByProduct`.
 */
export interface NoteLogisticsRow extends NoteLineItem {
    uomOptions: readonly EditableChoice[]
}

/** A line that must be manufactured first and does not auto-finish: no immediate dispatch on a debit note. */
export const isRestrictedLine = (item: NoteLineItem, isCreditNote: boolean): boolean =>
    !isCreditNote && (item.productType === "MANUFACTURABLE" || Boolean(item.hasBom)) && !item.mfgAutoFinalize

export const noteLogisticsLineEntity = defineEntity<NoteLogisticsRow>()((f) => ({
    title: "Línea a procesar",
    rowId: (l) => String(l.lineId),
    fields: {
        product: f.text("productName", { label: "Producto" }),
        total: f.quantity("noteQuantity", { label: "Total" }),
    },
}))

export function noteLogisticsEditable(isCreditNote: boolean) {
    const eligible = (l: NoteLogisticsRow): Eligibility => {
        if (isRestrictedLine(l, isCreditNote)) return { ok: false, reason: "Requiere producción" }
        if (!l.createsStockMove && l.productType !== "MANUFACTURABLE" && !l.hasBom) return { ok: false, reason: "Sin control de stock" }
        return { ok: true }
    }
    return defineEditable(noteLogisticsLineEntity, {
        rowKey: (l) => String(l.lineId),
        context: ["product", "total"],
        inputs: {
            quantity: {
                kind: "quantity",
                header: "A procesar",
                label: (l) => `Cantidad a procesar — ${l.productName}`,
                max: (l) => l.noteQuantity ?? 0,
                step: () => 0.01,
            },
            uom: {
                kind: "choice",
                header: "Unidad",
                label: (l) => `Unidad — ${l.productName}`,
                options: (l) => l.uomOptions,
                initialText: (l) => (l.uomId === undefined ? "" : String(l.uomId)),
            },
        },
        eligible,
        bulk: ["fillToMax", "clear"],
        bulkLabels: { fillToMax: "Procesar todo" },
    })
}
