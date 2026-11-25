// Side-effect import: registers the `ledgerDate` kind (fecha del documento + hora de creación).
import "@/features/accounting"

import { defineEntity } from "@/components/entity-view"
import { isOrderCompleted } from "@/lib/workflow-status"
import { orderStageSummary } from "../utils/orderStage"
import type { SaleOrder } from "../types"

/**
 * Sale order (ADR-0087 lote 2b). One status vocabulary for table and card: the readable stage
 * plus the hub axes. `orderBy` marks the columns the server can sort as displayed; `groupKey` the ones it
 * groups (by the order status for «Estado»: the hub status is composite).
 */
export const saleOrderEntity = defineEntity<SaleOrder>()((f) => ({
    label: "sales.saleorder",
    fields: {
        folio: f.code((o) => o.display_id ?? o.number, { label: "Folio", orderBy: "number" }),
        customer: f.contact((o) => ({ id: o.customer, name: o.customer_name }), { label: "Cliente", orderBy: "customer__name", groupKey: "customer" }),
        date: f.value("ledgerDate", (o) => ({ date: o.date, createdAt: o.created_at }), { label: "Fecha", orderBy: "date", groupKey: "date" }),
        hub: f.hubStatus((o) => o, { label: "Estado", entity: "sales.saleorder", caption: orderStageSummary, groupKey: "status" }),
        channel: f.tags((o) => (o.channel_display ? [o.channel_display] : []), { label: "Canal", groupKey: "channel" }),
        lines: f.number((o) => o.lines?.length ?? 0, { label: "Líneas" }),
        total: f.money("total", { label: "Total", orderBy: "total" }),
        pending: f.money("pending_amount", { label: "Pendiente" }),
    },
    // Search, filters, sort, grouping and views (ADR-0158 §3). Params match `SaleOrderFilterSet`.
    query: {
        search: {
            placeholder: "Buscar órdenes…",
            scopes: [
                { field: "customer", param: "customer_name", suggestionsUrl: "sales/orders/filter-suggestions/" },
                { field: "folio", param: "number" },
                { label: "Producto", param: "product_name" },
            ],
        },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_after", paramTo: "date_before" },
            origin_status: { label: "Origen", control: "multi", options: [{ value: "DRAFT", label: "Borrador" }, { value: "ACTIVE", label: "Completado" }, { value: "CANCELLED", label: "Anulado" }] },
            delivery_status: { label: "Despacho", control: "multi", options: [{ value: "PENDING", label: "Pendiente" }, { value: "PARTIAL", label: "Parcial" }, { value: "DELIVERED", label: "Entregado" }] },
            production_status: { label: "Producción", control: "multi", options: [{ value: "none", label: "Sin OT" }, { value: "in_progress", label: "En proceso" }, { value: "finished", label: "Terminada" }] },
            billing_status: { label: "Facturación", control: "multi", options: [{ value: "INVOICED", label: "Facturado" }, { value: "PENDING", label: "No facturado" }] },
            payment_status: { label: "Pago", control: "multi", options: [{ value: "UNPAID", label: "Pendiente" }, { value: "PARTIAL", label: "Parcial" }, { value: "PAID", label: "Pagado" }] },
            total: { field: "total", control: "range", paramFrom: "total_min", paramTo: "total_max" },
        },
        sort: { fields: ["date", "folio", "customer", "total"], default: "-date" },
        // Grouped on the server (`groups/`): every field declares its `groupKey`; the subtotal is the total.
        groupBy: { fields: ["date", "customer", "hub", "channel"], aggregate: { total: "sum" } },
        views: [
            { id: "all", label: "Todas" },
            { id: "to-deliver", label: "Por despachar", filters: { origin_status: "ACTIVE", delivery_status: ["PENDING", "PARTIAL"] } },
            { id: "to-invoice", label: "Por facturar", filters: { origin_status: "ACTIVE", billing_status: "PENDING" } },
            { id: "to-collect", label: "Por cobrar", filters: { origin_status: "ACTIVE", payment_status: ["UNPAID", "PARTIAL"] } },
            { id: "drafts", label: "Borradores", filters: { origin_status: "DRAFT" } },
        ],
    },
}))

export const saleOrderViews = saleOrderEntity.views({
    table: { primary: "folio", columns: ["date", "folio", "customer", "channel", "hub", "total"] },
    card: {
        title: "folio",
        subtitle: ["customer", "date"],
        trailing: ["hub"],
        media: { tone: (o) => (o.status === "CANCELLED" ? "muted" : isOrderCompleted(o) ? "success" : "primary") },
        rail: { status: (o) => (isOrderCompleted(o) ? "SUCCESS" : o.status) },
        footer: { value: "total", align: "end", lines: true },
    },
})
