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
        }), { label: "Tipo" }),
        customer: f.contact((d) => (d.customer_name ? { id: d.customer_id ?? 0, name: d.customer_name } : null), { label: "Cliente", orderBy: "sale_order__customer__name" }),
        order: docRef(f, (d) => d.sale_order_document ? { label: d.sale_order_document.label, id: d.sale_order_document.id, display: d.sale_order_document.display_id, url: d.sale_order_document.url } : null, { label: "Orden de Venta", sortable: false }),
        date: f.date((d) => d.date ?? d.delivery_date ?? "", { label: "Fecha", orderBy: "date" }),
        warehouse: f.text("warehouse_name", { label: "Bodega", tone: "secondary" }),
        status: f.status((d) => ({
            status: d.status,
            label: d.status_display,
            intent: d.status === "CONFIRMED"
                ? "success"
                : d.status === "CANCELLED"
                    ? "destructive"
                    : "info",
        }), { label: "Estado" }),
        cost: f.money("total_cost", { label: "Costo", orderBy: "total_cost" }),
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
