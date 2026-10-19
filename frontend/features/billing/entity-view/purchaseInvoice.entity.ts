import { defineEntity } from "@/components/entity-view"
import { getDtePrefix } from "@/lib/entity-registry"
import type { Invoice } from "../types"

/** Purchase invoices/notes list (ADR-0087 oleada B1). Same hub and `total` convention as `salesInvoiceEntity`. */
export const purchaseInvoiceEntity = defineEntity<Invoice>()((f) => ({
    label: "billing.invoice",
    fields: {
        folio: f.code((inv) => {
            const id = inv.display_id ?? inv.number
            return id ? `${getDtePrefix(inv.dte_type)}-${id}` : null
        }, { label: "Folio" }),
        date: f.date("date", { label: "Fecha Emisión" }),
        supplier: f.contact((inv) => (inv.partner_name ? { id: inv.partner_id ?? inv.supplier ?? 0, name: inv.partner_name } : null), { label: "Proveedor" }),
        dteType: f.text("dte_type_display", { label: "Tipo DTE" }),
        hub: f.hubStatus((inv) => inv, { label: "Estado", entity: "billing.invoice", caption: (inv) => ({ status: inv.status, label: inv.status_display }) }),
        total: f.money("total", { label: "Total" }),
    },
}))

export const purchaseInvoiceViews = purchaseInvoiceEntity.views({
    table: { columns: ["folio", "date", "supplier", "dteType", "hub", "total"], primary: "folio" },
    card: {
        title: "folio",
        subtitle: ["dteType", "supplier", "date"],
        trailing: ["total"],
        media: { tone: (inv) => (inv.dte_type === "NOTA_CREDITO" ? "destructive" : inv.dte_type === "NOTA_DEBITO" ? "warning" : "default") },
    },
})
