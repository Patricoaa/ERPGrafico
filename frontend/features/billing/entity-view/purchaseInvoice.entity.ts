import { defineEntity } from "@/components/entity-view"
import type { Invoice } from "../types"

/** Credit notes reduce the balance: shown with sign (gap found in 02 §3 #3: NC displayed positive). */
const signed = (i: Invoice): number => (i.dte_type === "NOTA_CREDITO" ? -Math.abs(Number(i.total)) : Number(i.total))

/** Purchase notes/invoices — used by the "notes" mode of the purchasing screen. */
export const purchaseInvoiceEntity = defineEntity<Invoice>()((f) => ({
    label: "billing.invoice",
    fields: {
        dteType: f.text("dte_type_display", { label: "Documento" }),
        folio: f.code((i) => i.display_id ?? i.number ?? null, { label: "Folio" }),
        date: f.date("date", { label: "Fecha" }),
        partner: f.text((i) => i.supplier_name || i.partner_name, { label: "Proveedor" }),
        hub: f.hubStatus((i) => i, { label: "Estado", entity: "billing.invoice", caption: (i) => ({ status: i.status, label: i.status_display }) }),
        total: f.money(signed, { label: "Total" }),
    },
}))

export const purchaseInvoiceViews = purchaseInvoiceEntity.views({
    table: { columns: ["dteType", "folio", "date", "partner", "hub", "total"], primary: "folio", defaultSort: "-date" },
    card: {
        title: "folio",
        subtitle: ["dteType", "partner", "date"],
        trailing: ["total"],
        media: { tone: (i) => (i.dte_type === "NOTA_CREDITO" ? "destructive" : i.dte_type === "NOTA_DEBITO" ? "warning" : "default") },
    },
})
