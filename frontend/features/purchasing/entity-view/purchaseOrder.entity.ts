import { defineEntity } from "@/components/entity-view"
import { isOrderCompleted } from "@/lib/workflow-status"
import type { PurchaseOrderAPI } from "../types"

const RECEIVING = {
    PENDING: { status: "PENDING", label: "Por recibir" },
    PARTIAL: { status: "PARTIAL", label: "Parcial" },
    RECEIVED: { status: "RECEIVED", label: "Recibida" },
} as const

/**
 * Purchase order (ADR-0087 lote 2c). The reception/billing/treasury facets are server filters
 * (`purchaseOrderUnifiedSearchDef`), not hidden columns. `orderBy` marks the columns the server
 * can sort as displayed.
 */
export const purchaseOrderEntity = defineEntity<PurchaseOrderAPI>()((f) => ({
    label: "purchasing.purchaseorder",
    fields: {
        folio: f.code((o) => o.display_id ?? o.number, { label: "Folio", orderBy: "number" }),
        supplier: f.contact((o) => ({ id: typeof o.supplier === "number" ? o.supplier : o.supplier.id, name: o.supplier_name }), { label: "Proveedor", orderBy: "supplier__name" }),
        date: f.date("date", { label: "Fecha", orderBy: "date" }),
        expected: f.date("receipt_date", { label: "Entrega esperada", orderBy: "receipt_date" }),
        warehouse: f.text("warehouse_name", { label: "Almacén", tone: "secondary" }),
        receiving: f.status((o) => RECEIVING[o.receiving_status], { label: "Recepción" }),
        hub: f.hubStatus((o) => o, {
            label: "Estado",
            entity: "purchasing.purchaseorder",
            caption: (o) =>
                isOrderCompleted(o)
                    ? { status: "SUCCESS", label: "Completada" }
                    : { status: o.status, label: o.status_display },
        }),
        lines: f.number((o) => o.lines.length, { label: "Líneas" }),
        total: f.money("total", { label: "Total", orderBy: "total" }),
        pending: f.money("pending_amount", { label: "Pendiente" }),
    },
}))

export const purchaseOrderViews = purchaseOrderEntity.views({
    table: { columns: ["folio", "supplier", "date", "expected", "warehouse", "hub", "total"] },
    card: {
        title: "folio",
        subtitle: ["supplier", "date"],
        trailing: ["hub", "total"],
        media: { tone: (o) => (o.status === "CANCELLED" ? "muted" : isOrderCompleted(o) ? "success" : "info") },
        rail: { status: (o) => (isOrderCompleted(o) ? "SUCCESS" : o.status) },
        body: { kind: "lines" },
    },
})
