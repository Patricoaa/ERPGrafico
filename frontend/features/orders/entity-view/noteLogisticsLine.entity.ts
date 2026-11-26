import { defineEditable, defineEntity } from "@/components/entity-view"

/**
 * Supplementary dispatch / receipt (or return) of a posted note's goods (ADR-0087 P1): how much of
 * each product moves now, capped by what is still pending.
 */
export interface NoteInvoiceLine {
    product_id: number
    product_name: string
    quantity: number
    quantity_delivered?: number
    quantity_received?: number
    uom_id?: number
    uom_name?: string
}

/** A note line with what was already moved: delivered on sales, received on purchases. */
export interface NoteLogisticsLine extends NoteInvoiceLine {
    processed: number
    pending: number
}

export const toNoteLogisticsLines = (lines: readonly NoteInvoiceLine[], isSale: boolean): NoteLogisticsLine[] =>
    lines.map((line) => {
        const processed = isSale ? (line.quantity_delivered || 0) : (line.quantity_received || 0)
        return { ...line, processed, pending: Math.max(0, line.quantity - processed) }
    })

export const noteLogisticsLineEntity = defineEntity<NoteLogisticsLine>()((f) => ({
    title: "Línea de nota",
    rowId: (l) => l.product_id,
    fields: {
        product: f.text("product_name", { label: "Producto" }),
        quantity: f.quantity("quantity", { label: "Cantidad nota" }),
        processed: f.quantity("processed", { label: "Procesado" }),
        pending: f.quantity("pending", { label: "Pendiente" }),
    },
}))

export const noteLogisticsLinesEditable = defineEditable(noteLogisticsLineEntity, {
    rowKey: (l) => l.product_id,
    context: ["product", "quantity", "processed", "pending"],
    inputs: {
        toProcess: {
            kind: "quantity",
            header: "A procesar",
            label: (l) => `Cantidad a procesar — ${l.product_name}`,
            max: (l) => l.pending,
            initial: (l) => l.pending,
            unit: (l) => l.uom_name,
        },
    },
    footer: { sum: ["toProcess"] },
    bulk: ["fillToMax", "clear"],
    bulkLabels: { fillToMax: "Procesar todo lo pendiente" },
})
