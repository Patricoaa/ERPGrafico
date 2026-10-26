import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"

/**
 * Sale delivery header (ADR-0090). The "Guías de Despacho" list is its own entity: it used to
 * render sale orders (`viewMode="orders"`), which promised a document it did not show.
 * `orderBy` marks the columns the server can sort as displayed (`SaleDeliveryViewSet.ordering_fields`).
 */
export interface SaleDelivery {
    id: number
    number: string
    display_id?: string | null
    status: string
    status_display?: string
    delivery_date: string
    sale_order_number?: string | null
    customer_name?: string | null
    customer_id?: number | null
    warehouse_name?: string | null
    sale_order_document?: { label: string; id: number; display_id: string; url: string } | null
    total_cost?: string | number
    lines?: unknown[]
}

export const saleDeliveryEntity = defineEntity<SaleDelivery>()((f) => ({
    label: "sales.saledelivery",
    fields: {
        folio: f.code((d) => d.display_id ?? d.number, { label: "Folio", orderBy: "number" }),
        customer: f.contact((d) => (d.customer_name ? { id: d.customer_id ?? 0, name: d.customer_name } : null), { label: "Cliente", orderBy: "sale_order__customer__name" }),
        order: docRef(f, (d) => d.sale_order_document ? { label: d.sale_order_document.label, id: d.sale_order_document.id, display: d.sale_order_document.display_id, url: d.sale_order_document.url } : null, { label: "Orden de Venta", sortable: false }),
        date: f.date("delivery_date", { label: "Fecha", orderBy: "delivery_date" }),
        warehouse: f.text("warehouse_name", { label: "Bodega", tone: "secondary" }),
        status: f.status((d) => ({
            status: d.status,
            label: d.status_display,
            intent: d.status === "CONFIRMED" ? "success" : d.status === "CANCELLED" ? "destructive" : "info",
        }), { label: "Estado" }),
        cost: f.money("total_cost", { label: "Costo", orderBy: "total_cost" }),
    },
}))

export const saleDeliveryViews = saleDeliveryEntity.views({
    table: { columns: ["folio", "customer", "order", "date", "warehouse", "status", "cost"], primary: "folio" },
    card: {
        rail: { status: (d) => (d.status === "CONFIRMED" ? "SUCCESS" : d.status) },
        title: "folio",
        subtitle: ["customer", "date"],
        trailing: ["status"],
        media: { tone: (d) => (d.status === "CANCELLED" ? "muted" : "success") },
    },
})
