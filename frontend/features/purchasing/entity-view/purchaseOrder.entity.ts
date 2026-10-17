import { defineEntity } from "@/components/entity-view"
import { getHubStatuses } from "@/lib/workflow-status"
import type { PurchaseOrderAPI } from "../types"

const RECEIVING = {
    PENDING: { status: "PENDING", label: "Por recibir" },
    PARTIAL: { status: "PARTIAL", label: "Parcial" },
    RECEIVED: { status: "RECEIVED", label: "Recibida" },
} as const

const hubAxes = (o: PurchaseOrderAPI) => getHubStatuses(o as unknown as Parameters<typeof getHubStatuses>[0])

/** Purchase order — most rigid screen (2 computed, 3 hidden facet columns, notes mode, 881-line view). */
export const purchaseOrderEntity = defineEntity<PurchaseOrderAPI>()((f) => ({
    label: "purchasing.purchaseorder",
    fields: {
        folio: f.code((o) => o.display_id ?? o.number, { label: "Folio" }),
        supplier: f.contact((o) => ({ id: typeof o.supplier === "number" ? o.supplier : o.supplier.id, name: o.supplier_name }), { label: "Proveedor" }),
        date: f.date("date", { label: "Fecha" }),
        expected: f.date("receipt_date", { label: "Entrega esperada" }),
        warehouse: f.text("warehouse_name", { label: "Bodega", tone: "secondary" }),   // was an inline column
        receiving: f.status((o) => RECEIVING[o.receiving_status], { label: "Recepción" }),
        hub: f.hubStatus((o) => o, { label: "Estado", entity: "purchasing.purchaseorder", caption: (o) => ({ status: o.status, label: o.status_display }) }),
        lines: f.number((o) => o.lines.length, { label: "Líneas" }),
        total: f.money("total", { label: "Total" }),
        pending: f.money("pending_amount", { label: "Pendiente" }),
    },
    // Facets are dimensions, not columns: the 3 hidden columns of the current view disappear.
    facets: {
        reception: (o) => hubAxes(o).logistics,
        billing: (o) => hubAxes(o).billing,
        treasury: (o) => hubAxes(o).treasury,
    },
}))

export const purchaseOrderViews = purchaseOrderEntity.views({
    table: { columns: ["folio", "supplier", "date", "expected", "warehouse", "hub", "total"], defaultSort: "-date" },
    card: {
        title: "folio",
        subtitle: ["supplier", "date"],
        meta: ["warehouse"],
        trailing: ["hub"],
        media: { tone: "info" },
        body: { kind: "workflow", lines: "lines", total: "total", pending: "pending", date: "expected" },
    },
})
