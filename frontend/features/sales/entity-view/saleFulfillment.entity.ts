import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"
import { resolveFulfillmentIcon } from "@/lib/movement-icons"

/**
 * Unified fulfillment document (SaleDelivery + SaleReturn).
 * `fulfillment_type` discriminates: "DELIVERY" | "RETURN".
 * ADR-0090: merged list for "Despachos y Devoluciones".
 */
export interface SaleFulfillment {
    id: number
    number: string
    display_id?: string | null
    fulfillment_type: "DELIVERY" | "RETURN"
    status: string
    status_display?: string
    date: string              // delivery_date for DELIVERY, date for RETURN
    delivery_date?: string    // for DELIVERY
    sale_order_number?: string | null
    customer_name?: string | null
    customer_id?: number | null
    warehouse_name?: string | null
    sale_order_document?: { label: string; id: number; display_id: string; url: string } | null
    total_cost?: string | number
    lines?: unknown[]
}

export const saleFulfillmentEntity = defineEntity<SaleFulfillment>()((f) => ({
    label: "sales.saledelivery",
    // IDs come from two separate DB tables (saledelivery + salereturn), so numeric
    // IDs can collide. Compound key prevents duplicate React keys in the card grid.
    rowId: (d) => `${d.fulfillment_type}-${d.id}`,
    fields: {
        folio: f.code((d) => d.display_id ?? d.number, { label: "Folio", orderBy: "number" }),
        type: f.status((d) => ({
            status: d.fulfillment_type,
            label: d.fulfillment_type === "DELIVERY" ? "Despacho" : "Devolución",
            intent: d.fulfillment_type === "DELIVERY" ? "success" : "destructive",
        }), { label: "Tipo", groupKey: "type" }),
        customer: f.contact((d) => (d.customer_name ? { id: d.customer_id ?? 0, name: d.customer_name } : null), { label: "Cliente", orderBy: "sale_order__customer__name", groupKey: "customer" }),
        order: docRef(f, (d) => d.sale_order_document ? { label: d.sale_order_document.label, id: d.sale_order_document.id, display: d.sale_order_document.display_id, url: d.sale_order_document.url } : null, { label: "Orden de Venta", sortable: false }),
        date: f.date((d) => d.date ?? d.delivery_date ?? "", { label: "Fecha", orderBy: "date", groupKey: "date" }),
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
            placeholder: "Buscar despachos y devoluciones…",
            scopes: [
                { label: "Orden de Venta", param: "sale_order_number" },
                { field: "customer", param: "customer_name" },
            ],
        },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_after", paramTo: "date_before" },
            fulfillment_type: { field: "type", control: "multi", options: [{ value: "DELIVERY", label: "Despacho" }, { value: "RETURN", label: "Devolución" }] },
            status: { field: "status", control: "multi", options: [{ value: "DRAFT", label: "Borrador" }, { value: "CONFIRMED", label: "Confirmado" }, { value: "CANCELLED", label: "Anulado" }] },
        },
        // Grouped on the server (`fulfillment/groups/`): both document types merged per group.
        groupBy: { fields: ["date", "customer", "status", "type"], aggregate: { cost: "sum" } },
        views: [
            { id: "all", label: "Todos" },
            { id: "deliveries", label: "Despachos", filters: { fulfillment_type: "DELIVERY" } },
            { id: "returns", label: "Devoluciones", filters: { fulfillment_type: "RETURN" } },
            { id: "drafts", label: "Borradores", filters: { status: "DRAFT" } },
        ],
    },
}))

export const saleFulfillmentViews = saleFulfillmentEntity.views({
    table: { columns: ["folio", "type", "customer", "order", "date", "warehouse", "status", "cost"], primary: "folio" },
    card: {
        rail: {
            status: (d) => {
                if (d.status === "CANCELLED") return "CANCELLED"
                if (d.status === "DRAFT") return "DRAFT"
                return d.fulfillment_type === "DELIVERY" ? "SUCCESS" : "DESTRUCTIVE"
            },
        },
        title: "folio",
        subtitle: ["customer", "date"],
        trailing: ["type", "status"],
        media: {
            iconFor: (d) => resolveFulfillmentIcon(d.fulfillment_type),
            tone: (d) => {
                if (d.status === "CANCELLED") return "muted"
                return d.fulfillment_type === "DELIVERY" ? "success" : "destructive"
            },
        },
    },
})
