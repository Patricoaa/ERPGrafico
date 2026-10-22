import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"

/**
 * Unified fulfillment document (PurchaseReceipt + PurchaseReturn).
 * `fulfillment_type` discriminates: "RECEIPT" | "RETURN".
 * ADR-0090: merged list for "Recepciones y Devoluciones".
 */
export interface PurchaseFulfillment {
    id: number
    number: string
    display_id?: string | null
    fulfillment_type: "RECEIPT" | "RETURN"
    status: string
    status_display?: string
    date: string              // receipt_date for RECEIPT, date for RETURN
    receipt_date?: string     // for RECEIPT
    purchase_order_number?: string | null
    supplier_name?: string | null
    supplier_id?: number | null
    warehouse_name?: string | null
    purchase_order_document?: { label: string; id: number; display_id: string; url: string } | null
    total_cost?: string | number
    lines?: unknown[]
}

export const purchaseFulfillmentEntity = defineEntity<PurchaseFulfillment>()((f) => ({
    label: "purchasing.purchasereceipt",
    fields: {
        folio: f.code((d) => d.display_id ?? d.number, { label: "Folio", orderBy: "number" }),
        type: f.status((d) => ({
            status: d.fulfillment_type,
            label: d.fulfillment_type === "RECEIPT" ? "Recepción" : "Devolución",
        }), { label: "Tipo" }),
        supplier: f.contact((d) => (d.supplier_name ? { id: d.supplier_id ?? 0, name: d.supplier_name } : null), { label: "Proveedor", orderBy: "purchase_order__supplier__name" }),
        order: docRef(f, (d) => d.purchase_order_document ? { label: d.purchase_order_document.label, id: d.purchase_order_document.id, display: d.purchase_order_document.display_id, url: d.purchase_order_document.url } : null, { label: "Orden de Compra", sortable: false }),
        date: f.date((d) => d.date ?? d.receipt_date ?? "", { label: "Fecha", orderBy: "date" }),
        warehouse: f.text("warehouse_name", { label: "Bodega", tone: "secondary" }),
        status: f.status((d) => ({ status: d.status, label: d.status_display }), { label: "Estado" }),
        cost: f.money("total_cost", { label: "Costo", orderBy: "total_cost" }),
    },
}))

export const purchaseFulfillmentViews = purchaseFulfillmentEntity.views({
    table: { columns: ["folio", "type", "supplier", "order", "date", "warehouse", "status", "cost"], primary: "folio" },
    card: {
        title: "folio",
        subtitle: ["supplier", "date"],
        trailing: ["type", "status"],
        media: { tone: (d) => {
            if (d.status === "CANCELLED") return "muted"
            return d.fulfillment_type === "RECEIPT" ? "primary" : "warning"
        }},
    },
})