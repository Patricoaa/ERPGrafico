import { defineEntity } from "@/components/entity-view"
import { docRef } from "@/features/documents"
import { TruckReturn } from "@/lib/movement-icons"

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
        customer: f.contact((r) => (r.customer_name ? { id: r.customer_id ?? 0, name: r.customer_name } : null), { label: "Cliente", orderBy: "sale_order__customer__name", groupKey: "customer" }),
        order: docRef(f, (r) => r.sale_order_document ? { label: r.sale_order_document.label, id: r.sale_order_document.id, display: r.sale_order_document.display_id, url: r.sale_order_document.url } : null, { label: "Orden de Venta", sortable: false }),
        date: f.date("date", { label: "Fecha", orderBy: "date", groupKey: "date" }),
        warehouse: f.text("warehouse_name", { label: "Bodega", tone: "secondary" }),
        status: f.status((r) => ({
            status: r.status,
            label: r.status_display,
            intent: r.status === "CONFIRMED" ? "destructive" : r.status === "CANCELLED" ? "destructive" : "info",
        }), { label: "Estado", groupKey: "status" }),
        cost: f.money("total_cost", { label: "Costo", orderBy: "total_cost" }),
    },
    // ADR-0158 §3. Params match the backend FilterSet.
    query: {
        search: {
            placeholder: "Buscar devoluciones…",
            scopes: [
                { label: "Orden de Venta", param: "sale_order_number" },
                { field: "customer", param: "customer_name" },
            ],
        },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_after", paramTo: "date_before" },
            status: { field: "status", control: "multi", options: [{ value: "DRAFT", label: "Borrador" }, { value: "CONFIRMED", label: "Confirmado" }, { value: "CANCELLED", label: "Anulado" }], counts: true },
        },
        sort: { fields: ["folio", "customer", "date", "cost"], default: "-date" },
        groupBy: { fields: ["date", "customer", "status"], aggregate: { cost: "sum" } },
        views: [
            { id: "all", label: "Todas", count: true },
            { id: "drafts", label: "Borradores", filters: { status: "DRAFT" }, count: true },
        ],
    },
}))

export const saleReturnViews = saleReturnEntity.views({
    table: { columns: ["folio", "customer", "order", "date", "warehouse", "status", "cost"], primary: "folio" },
    card: {
        rail: { status: (r) => (r.status === "CONFIRMED" ? "DESTRUCTIVE" : r.status) },
        title: "folio",
        subtitle: ["customer", "date"],
        trailing: ["status"],
        media: {
            iconFor: () => TruckReturn,
            tone: (r) => (r.status === "CANCELLED" ? "muted" : "destructive"),
        },
    },
})
