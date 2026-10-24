import { defineEntity } from "@/components/entity-view"
import { isOrderCompleted } from "@/lib/workflow-status"
import { orderStageSummary } from "../utils/orderStage"
import type { SaleOrder } from "../types"

/**
 * Sale order (ADR-0087 lote 2b). One status vocabulary for table and card: the readable stage
 * plus the hub axes. `orderBy` marks the columns the server can sort as displayed.
 */
export const saleOrderEntity = defineEntity<SaleOrder>()((f) => ({
    label: "sales.saleorder",
    fields: {
        folio: f.code((o) => o.display_id ?? o.number, { label: "Folio", orderBy: "number" }),
        customer: f.contact((o) => ({ id: o.customer, name: o.customer_name }), { label: "Cliente", orderBy: "customer__name" }),
        date: f.date("date", { label: "Fecha", orderBy: "date" }),
        hub: f.hubStatus((o) => o, { label: "Estado", entity: "sales.saleorder", caption: orderStageSummary }),
        channel: f.tags((o) => (o.channel_display ? [o.channel_display] : []), { label: "Canal" }),
        lines: f.number((o) => o.lines?.length ?? 0, { label: "Líneas" }),
        total: f.money("total", { label: "Total", orderBy: "total" }),
        pending: f.money("pending_amount", { label: "Pendiente" }),
    },
}))

export const saleOrderViews = saleOrderEntity.views({
    table: { columns: ["folio", "customer", "date", "channel", "hub", "total", "pending"] },
    card: {
        title: "folio",
        subtitle: ["customer", "date"],
        trailing: ["hub"],
        media: { tone: (o) => (o.status === "CANCELLED" ? "muted" : isOrderCompleted(o) ? "success" : "primary") },
        rail: { status: (o) => (isOrderCompleted(o) ? "SUCCESS" : o.status) },
        body: { kind: "workflow", lines: "lines", total: "total", pending: "pending" },
    },
})
