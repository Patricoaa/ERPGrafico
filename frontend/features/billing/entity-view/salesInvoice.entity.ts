import { defineEntity } from "@/components/entity-view"
import { getDtePrefix } from "@/lib/entity-registry"
import type { Invoice } from "../types"

/**
 * Sales invoices/notes list (ADR-0087 oleada B1). Same hub ("billing.invoice") already in
 * production in `saleNoteEntity` (sales orders screen, "notes" mode); here without the flow
 * sign on `total` — this list, unlike that one, shows the document's own total (`02` §3 #3).
 */
export const salesInvoiceEntity = defineEntity<Invoice>()((f) => ({
    label: "billing.invoice",
    fields: {
        folio: f.code((inv) => {
            const id = inv.display_id ?? inv.number
            return id ? `${getDtePrefix(inv.dte_type)}-${id}` : null
        }, { label: "Folio" }),
        date: f.date("date", { label: "Fecha" }),
        customer: f.contact((inv) => (inv.partner_name ? { id: inv.partner_id ?? 0, name: inv.partner_name } : null), { label: "Cliente" }),
        dteType: f.text("dte_type_display", { label: "Tipo DTE" }),
        hub: f.hubStatus((inv) => inv, { label: "Estado", entity: "billing.invoice", caption: (inv) => ({ status: inv.status, label: inv.status_display }) }),
        total: f.money("total", { label: "Total" }),
    },
}))

export const salesInvoiceViews = salesInvoiceEntity.views({
    table: { columns: ["folio", "date", "customer", "dteType", "hub", "total"], primary: "folio" },
    card: {
        title: "folio",
        subtitle: ["dteType", "customer", "date"],
        trailing: ["total"],
        media: { tone: (inv) => (inv.dte_type === "NOTA_CREDITO" ? "destructive" : inv.dte_type === "NOTA_DEBITO" ? "warning" : "default") },
    },
})
