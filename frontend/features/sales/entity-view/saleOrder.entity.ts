import { defineEntity, type ExportFormat } from "@/components/entity-view"
import { orderStageSummary } from "../salesOrderFields"
import type { SaleOrder } from "../types"

/**
 * Export hook (export-formats.md: one hook per export, in its feature).
 * Pd-backend: `/api/sales/orders/export/` does not exist yet; the spike records the request only.
 */
function useExportSaleOrdersStub(): { run: (format: ExportFormat, filters: Record<string, unknown>) => void; isPending: boolean } {
    return { run: () => undefined, isPending: false }
}

/** Sale order — documental entity (3 computed + notes mode today). */
export const saleOrderEntity = defineEntity<SaleOrder>()((f) => ({
    label: "sales.saleorder",
    fields: {
        folio: f.code((o) => o.display_id ?? o.number, { label: "Folio" }),
        customer: f.contact((o) => ({ id: o.customer, name: o.customer_name }), { label: "Cliente" }),
        date: f.date("date", { label: "Fecha" }),
        // One status vocabulary for table and card: readable stage + hub axes (was two computed, F + G).
        hub: f.hubStatus((o) => o, { label: "Estado", entity: "sales.saleorder", caption: orderStageSummary }),
        channel: f.tags((o) => (o.channel_display ? [o.channel_display] : []), { label: "Canal" }),
        lines: f.number((o) => o.lines?.length ?? 0, { label: "Líneas" }),
        total: f.money("total", { label: "Total" }),
        pending: f.money("pending_amount", { label: "Pendiente" }),
    },
    facets: {
        payment: (o) => o.payment_status,
        delivery: (o) => o.delivery_status,
    },
    export: { useExport: useExportSaleOrdersStub, formats: ["xlsx", "csv"] },
}))

export const saleOrderViews = saleOrderEntity.views({
    table: { columns: ["folio", "customer", "date", "channel", "hub", "total", "pending"], defaultSort: "-date" },
    card: {
        title: "folio",
        subtitle: ["customer", "date"],
        trailing: ["hub"],
        media: { tone: (o) => (o.status === "CANCELLED" ? "muted" : "primary") },
        body: { kind: "workflow", lines: "lines", total: "total", pending: "pending" },      // was computed (D)
    },
})
