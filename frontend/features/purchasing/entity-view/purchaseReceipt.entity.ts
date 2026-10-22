import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"

/**
 * Purchase receipt header (ADR-0090). The "Recepciones" list is its own entity over
 * `purchasing.purchasereceipt`; its `list_url` used to point at a route that did not exist
 * (`/purchasing/receipts`, ratchet `KNOWN_BROKEN_LIST_URLS`).
 * `orderBy` marks the columns the server can sort as displayed (`PurchaseReceiptViewSet.ordering_fields`).
 */
export interface PurchaseReceipt {
    id: number
    number: string
    display_id?: string | null
    status: string
    status_display?: string
    receipt_date: string
    purchase_order_number?: string | null
    supplier_name?: string | null
    supplier_id?: number | null
    warehouse_name?: string | null
    purchase_order_document?: { label: string; id: number; display_id: string; url: string } | null
    total_cost?: string | number
    lines?: unknown[]
}

export const purchaseReceiptEntity = defineEntity<PurchaseReceipt>()((f) => ({
    label: "purchasing.purchasereceipt",
    fields: {
        folio: f.code((r) => r.display_id ?? r.number, { label: "Folio", orderBy: "number" }),
        supplier: f.contact((r) => (r.supplier_name ? { id: r.supplier_id ?? 0, name: r.supplier_name } : null), { label: "Proveedor", orderBy: "purchase_order__supplier__name" }),
        order: docRef(f, (r) => r.purchase_order_document ? { label: r.purchase_order_document.label, id: r.purchase_order_document.id, display: r.purchase_order_document.display_id, url: r.purchase_order_document.url } : null, { label: "Orden de Compra", sortable: false }),
        date: f.date("receipt_date", { label: "Fecha", orderBy: "receipt_date" }),
        warehouse: f.text("warehouse_name", { label: "Bodega", tone: "secondary" }),
        status: f.status((r) => ({ status: r.status, label: r.status_display }), { label: "Estado" }),
        cost: f.money("total_cost", { label: "Costo", orderBy: "total_cost" }),
    },
}))

export const purchaseReceiptViews = purchaseReceiptEntity.views({
    table: { columns: ["folio", "supplier", "order", "date", "warehouse", "status", "cost"], primary: "folio" },
    card: {
        title: "folio",
        subtitle: ["supplier", "date"],
        trailing: ["status"],
        media: { tone: (r) => (r.status === "CANCELLED" ? "muted" : "primary") },
    },
})
