import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"
import { resolveFulfillmentIcon } from "@/lib/movement-icons"

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
            intent: d.fulfillment_type === "RECEIPT" ? "success" : "destructive",
        }), { label: "Tipo", groupKey: "type" }),
        supplier: f.contact((d) => (d.supplier_name ? { id: d.supplier_id ?? 0, name: d.supplier_name } : null), { label: "Proveedor", orderBy: "purchase_order__supplier__name", groupKey: "supplier" }),
        order: docRef(f, (d) => d.purchase_order_document ? { label: d.purchase_order_document.label, id: d.purchase_order_document.id, display: d.purchase_order_document.display_id, url: d.purchase_order_document.url } : null, { label: "Orden de Compra", sortable: false }),
        date: f.date((d) => d.date ?? d.receipt_date ?? "", { label: "Fecha", orderBy: "date", groupKey: "date" }),
        warehouse: f.text("warehouse_name", { label: "Bodega", tone: "secondary" }),
        status: f.status((d) => ({
            status: d.status,
            label: d.status_display,
            intent: d.status === "CONFIRMED"
                ? "success"
                : d.status === "CANCELLED"
                    ? "destructive"
                    : "info",
        }), { label: "Estado", groupKey: "status" }),
        cost: f.money("total_cost", { label: "Costo", orderBy: "total_cost" }),
    },
    // ADR-0158 §3. No `sort`: two endpoints merged in the client (newest first), so a server key
    // would only reorder each page before the merge.
    query: {
        search: {
            placeholder: "Buscar recepciones y devoluciones…",
            scopes: [
                { label: "Orden de Compra", param: "purchase_order_number" },
                { field: "supplier", param: "supplier_name" },
            ],
        },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_after", paramTo: "date_before" },
            fulfillment_type: { field: "type", control: "multi", options: [{ value: "RECEIPT", label: "Recepción" }, { value: "RETURN", label: "Devolución" }] },
            status: { field: "status", control: "multi", options: [{ value: "DRAFT", label: "Borrador" }, { value: "CONFIRMED", label: "Confirmado" }, { value: "CANCELLED", label: "Anulado" }] },
        },
        // Grouped on the server (`fulfillment/groups/`): both document types merged per group.
        groupBy: { fields: ["date", "supplier", "status", "type"], aggregate: { cost: "sum" } },
        views: [
            { id: "all", label: "Todos" },
            { id: "receipts", label: "Recepciones", filters: { fulfillment_type: "RECEIPT" } },
            { id: "returns", label: "Devoluciones", filters: { fulfillment_type: "RETURN" } },
            { id: "drafts", label: "Borradores", filters: { status: "DRAFT" } },
        ],
    },
}))

export const purchaseFulfillmentViews = purchaseFulfillmentEntity.views({
    table: { columns: ["folio", "type", "supplier", "order", "date", "warehouse", "status", "cost"], primary: "folio" },
    card: {
        rail: {
            status: (d) => {
                if (d.status === "CANCELLED") return "CANCELLED"
                if (d.status === "DRAFT") return "DRAFT"
                return d.fulfillment_type === "RECEIPT" ? "SUCCESS" : "DESTRUCTIVE"
            },
        },
        title: "folio",
        subtitle: ["supplier", "date"],
        trailing: ["type", "status"],
        media: {
            iconFor: (d) => resolveFulfillmentIcon(d.fulfillment_type),
            tone: (d) => {
                if (d.status === "CANCELLED") return "muted"
                return d.fulfillment_type === "RECEIPT" ? "success" : "destructive"
            },
        },
    },
})
