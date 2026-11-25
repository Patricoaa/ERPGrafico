import { defineEntity, toNumber } from "@/components/entity-view"
import { formatEntityDisplay } from "@/lib/entity-registry"
import type { POSSession } from "../components/POSSessionsClientView"

/** POS session (ADR-0087 oleada A2). Replaces posSessionFields.ts + renderCard. */
export const posSessionEntity = defineEntity<POSSession>()((f) => ({
    label: "pos.session",
    fields: {
        folio: f.code((s) => formatEntityDisplay("pos.session", { id: s.id }), { label: "ID" }),
        userName: f.text("user_name", { label: "Usuario" }),
        terminal: f.text("terminal_name", { label: "Punto de venta" }),
        openedAt: f.date("opened_at", { label: "Apertura", time: true }),
        closedAt: f.date("closed_at", { label: "Cierre", time: true }),
        // DRF sends decimals as strings: add numbers, never concatenate (TC-065).
        totalSales: f.money((s) => (toNumber(s.total_cash_sales) ?? 0) + (toNumber(s.total_card_sales) ?? 0), { label: "Ventas" }),
        status: f.status((s) => ({ status: s.status, label: s.status_display }), { label: "Estado" }),
    },
    // ADR-0158 §3, client mode: the list loads every session and sorts them in the browser.
    query: {
        search: { placeholder: "Buscar sesiones…" },
        filters: {
            date: { field: "openedAt", control: "date", paramFrom: "date_from", paramTo: "date_to" },
            status: { field: "status", control: "single", options: [{ value: "OPEN", label: "Abierta" }, { value: "CLOSED", label: "Cerrada" }] },
        },
        sort: { fields: ["openedAt", "closedAt", "folio", "userName", "terminal", "totalSales", "status"], default: "-openedAt" },
        groupBy: { fields: ["status", "terminal", "userName"] },
        views: [
            { id: "all", label: "Todas" },
            { id: "open", label: "Abiertas", filters: { status: "OPEN" } },
        ],
    },
}))

export const posSessionViews = posSessionEntity.views({
    table: { columns: ["folio", "userName", "terminal", "openedAt", "closedAt", "totalSales", "status"] },
    card: { rail: { status: (r) => r.status }, title: "folio", subtitle: ["userName", "terminal"], meta: ["openedAt", "closedAt"], trailing: ["status", "totalSales"] },
})
