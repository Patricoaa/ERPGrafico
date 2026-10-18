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
}))

export const posSessionViews = posSessionEntity.views({
    table: { columns: ["folio", "userName", "terminal", "openedAt", "closedAt", "totalSales", "status"], defaultSort: "-openedAt" },
    card: { title: "folio", subtitle: ["userName", "terminal"], meta: ["openedAt", "closedAt"], trailing: ["status", "totalSales"] },
})
