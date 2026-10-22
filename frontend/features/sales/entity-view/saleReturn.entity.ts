import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"

/**
 * Sale return header (ADR-0090). "Devoluciones" used to render the notes list
 * (`viewMode="notes"`); it is now its own document list over `sales.salereturn`.
 * `orderBy` marks the columns the server can sort as displayed (`SaleReturnViewSet.ordering_fields`).
 */
export interface SaleReturn {
    id: number
    number: string
    display_id?: string | null
    status: string
    status_display?: string
    date: string
    sale_order_number?: string | null
    customer_name?: string | null
    customer_id?: number | null
    warehouse_name?: string | null
    sale_order_document?: { label: string; id: number; display_id: string; url: string } | null
    total_cost?: string | number
    lines?: unknown[]
}

export const saleReturnEntity = defineEntity<SaleReturn>()((f) => ({
    label: "sales.salereturn",
    fields: {
        folio: f.code((r) => r.display_id ?? r.number, { label: "Folio", orderBy: "number" }),
        customer: f.contact((r) => (r.customer_name ? { id: r.customer_id ?? 0, name: r.customer_name } : null), { label: "Cliente", orderBy: "sale_order__customer__name" }),
        order: docRef(f, (r) => r.sale_order_document ? { label: r.sale_order_document.label, id: r.sale_order_document.id, display: r.sale_order_document.display_id, url: r.sale_order_document.url } : null, { label: "Orden de Venta", sortable: false }),
        date: f.date("date", { label: "Fecha", orderBy: "date" }),
        warehouse: f.text("warehouse_name", { label: "Bodega", tone: "secondary" }),
        status: f.status((r) => ({ status: r.status, label: r.status_display }), { label: "Estado" }),
        cost: f.money("total_cost", { label: "Costo", orderBy: "total_cost" }),
    },
}))

export const saleReturnViews = saleReturnEntity.views({
    table: { columns: ["folio", "customer", "order", "date", "warehouse", "status", "cost"], primary: "folio" },
    card: {
        title: "folio",
        subtitle: ["customer", "date"],
        trailing: ["status"],
        media: { tone: (r) => (r.status === "CANCELLED" ? "muted" : "warning") },
    },
})
