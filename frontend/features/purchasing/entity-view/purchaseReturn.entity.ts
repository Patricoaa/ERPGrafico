import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"

/**
 * Purchase return header (ADR-0090). Its own document list over `purchasing.purchasereturn`;
 * its `list_url` used to point at the purchase orders list (`/purchasing/orders`), which showed
 * orders instead of returns.
 * `orderBy` marks the columns the server can sort as displayed (`PurchaseReturnViewSet.ordering_fields`).
 */
export interface PurchaseReturn {
    id: number
    number: string
    display_id?: string | null
    status: string
    status_display?: string
    date: string
    purchase_order_number?: string | null
    supplier_name?: string | null
    supplier_id?: number | null
    warehouse_name?: string | null
    purchase_order_document?: { label: string; id: number; display_id: string; url: string } | null
    total_cost?: string | number
    lines?: unknown[]
}

export const purchaseReturnEntity = defineEntity<PurchaseReturn>()((f) => ({
    label: "purchasing.purchasereturn",
    fields: {
        folio: f.code((r) => r.display_id ?? r.number, { label: "Folio", orderBy: "number" }),
        supplier: f.contact((r) => (r.supplier_name ? { id: r.supplier_id ?? 0, name: r.supplier_name } : null), { label: "Proveedor", orderBy: "purchase_order__supplier__name" }),
        order: docRef(f, (r) => r.purchase_order_document ? { label: r.purchase_order_document.label, id: r.purchase_order_document.id, display: r.purchase_order_document.display_id, url: r.purchase_order_document.url } : null, { label: "Orden de Compra", sortable: false }),
        date: f.date("date", { label: "Fecha", orderBy: "date" }),
        warehouse: f.text("warehouse_name", { label: "Bodega", tone: "secondary" }),
        status: f.status((r) => ({ status: r.status, label: r.status_display }), { label: "Estado" }),
        cost: f.money("total_cost", { label: "Costo", orderBy: "total_cost" }),
    },
}))

export const purchaseReturnViews = purchaseReturnEntity.views({
    table: { columns: ["folio", "supplier", "order", "date", "warehouse", "status", "cost"], primary: "folio" },
    card: {
        rail: { status: (r) => r.status },
        title: "folio",
        subtitle: ["supplier", "date"],
        trailing: ["status"],
        media: { tone: (r) => (r.status === "CANCELLED" ? "muted" : "warning") },
    },
})
