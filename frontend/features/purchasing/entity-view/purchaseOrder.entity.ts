// Side-effect import: registers the `ledgerDate` kind (fecha del documento + hora de creación).
import "@/features/accounting"

import { defineEntity } from "@/components/entity-view"
import { isOrderCompleted } from "@/lib/workflow-status"
import type { PurchaseOrderAPI } from "../types"

const RECEIVING = {
    PENDING: { status: "PENDING", label: "Por recibir" },
    PARTIAL: { status: "PARTIAL", label: "Parcial" },
    RECEIVED: { status: "RECEIVED", label: "Recibida" },
} as const

/**
 * Purchase order (ADR-0087 lote 2c). The reception/billing/treasury facets are server filters
 * (`query.filters` below), not hidden columns. `orderBy` marks the columns the server
 * can sort as displayed.
 */
export const purchaseOrderEntity = defineEntity<PurchaseOrderAPI>()((f) => ({
    label: "purchasing.purchaseorder",
    fields: {
        folio: f.code((o) => o.display_id ?? o.number, { label: "Folio", orderBy: "number" }),
        supplier: f.contact((o) => ({ id: typeof o.supplier === "number" ? o.supplier : o.supplier.id, name: o.supplier_name }), { label: "Proveedor", orderBy: "supplier__name" }),
        date: f.value("ledgerDate", (o) => ({ date: o.date, createdAt: o.created_at }), { label: "Fecha", orderBy: "date", groupKey: "date" }),
        expected: f.date("receipt_date", { label: "Entrega esperada", orderBy: "receipt_date" }),
        warehouse: f.text("warehouse_name", { label: "Almacén", tone: "secondary" }),
        receiving: f.status((o) => RECEIVING[o.receiving_status], { label: "Recepción", groupKey: "receiving" }),
        hub: f.hubStatus((o) => o, {
            label: "Estado",
            groupKey: "status",
            entity: "purchasing.purchaseorder",
            caption: (o) =>
                isOrderCompleted(o)
                    ? { status: "SUCCESS", label: "Completada" }
                    : { status: o.status, label: o.status_display },
        }),
        lines: f.number((o) => o.lines.length, { label: "Líneas" }),
        total: f.money("total", { label: "Total", orderBy: "total" }),
        pending: f.money("pending_amount", { label: "Pendiente" }),
    },
    // Search, filters, sort, grouping and views (ADR-0158 §3). Params match `PurchaseOrderFilterSet`;
    // its status filters take one value (no comma lists), hence `single`.
    query: {
        search: {
            placeholder: "Buscar órdenes de compra…",
            scopes: [
                { field: "supplier", param: "supplier_name" },
                { field: "folio", param: "number" },
                { label: "Producto", param: "product_name" },
            ],
        },
        filters: {
            created_at: { label: "Fecha de creación", control: "date", paramFrom: "created_at_after", paramTo: "created_at_before" },
            receipt_date: { field: "expected", control: "date", paramFrom: "receipt_date_after", paramTo: "receipt_date_before" },
            origin_status: { label: "Origen", control: "single", options: [{ value: "DRAFT", label: "Borrador" }, { value: "ACTIVE", label: "Completado" }, { value: "CANCELLED", label: "Anulado" }] },
            receiving_status: { field: "receiving", control: "single", options: [{ value: "PENDING", label: "Pendiente" }, { value: "PARTIAL", label: "Parcial" }, { value: "RECEIVED", label: "Recibido" }] },
            billing_status: { label: "Facturación", control: "single", options: [{ value: "PENDING", label: "Pendiente" }, { value: "INVOICED", label: "Facturado" }] },
            treasury_status: { label: "Tesorería", control: "single", options: [{ value: "UNPAID", label: "Pendiente" }, { value: "PARTIAL", label: "Parcial" }, { value: "PAID", label: "Pagado" }] },
            total: { field: "total", control: "range", paramFrom: "total_min", paramTo: "total_max" },
        },
        sort: { fields: ["date", "folio", "supplier", "expected", "total"], default: "-date" },
        groupBy: { fields: ["date", "hub", "receiving"], aggregate: { total: "sum" } },
        views: [
            // `count: true`: the tab shows its total. «Por pagar» has none: payment is evaluated in Python.
            { id: "all", label: "Todas", count: true },
            { id: "to-receive", label: "Por recibir", filters: { origin_status: "ACTIVE", receiving_status: "PENDING" }, count: true },
            { id: "to-invoice", label: "Por facturar", filters: { origin_status: "ACTIVE", billing_status: "PENDING" }, count: true },
            { id: "to-pay", label: "Por pagar", filters: { origin_status: "ACTIVE", treasury_status: "UNPAID" } },
            { id: "drafts", label: "Borradores", filters: { origin_status: "DRAFT" }, count: true },
        ],
    },
}))

export const purchaseOrderViews = purchaseOrderEntity.views({
    table: { primary: "folio", columns: ["date", "folio", "supplier", "expected", "warehouse", "hub", "total"] },
    card: {
        title: "folio",
        subtitle: ["supplier", "date"],
        trailing: ["hub"],
        media: { tone: (o) => (o.status === "CANCELLED" ? "muted" : isOrderCompleted(o) ? "success" : "info") },
        rail: { status: (o) => (isOrderCompleted(o) ? "SUCCESS" : o.status) },
        footer: { value: "total", align: "end", lines: true },
    },
})
