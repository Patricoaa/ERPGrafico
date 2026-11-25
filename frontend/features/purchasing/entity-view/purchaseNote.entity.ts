import { defineEntity } from "@/components/entity-view"
import { isInvoiceCompleted } from "@/lib/workflow-status"
import type { Invoice } from "@/features/billing"

/** Credit notes reduce the balance: shown with sign (gap found in 02 §3 #3: NC displayed positive). */
const signed = (i: Invoice): number => (i.dte_type === "NOTA_CREDITO" ? -Math.abs(Number(i.total)) : Number(i.total))

/** Credit/debit notes of purchase orders — the "notes" mode of the purchasing screen (ADR-0087 lote 2c). */
export const purchaseNoteEntity = defineEntity<Invoice>()((f) => ({
    label: "billing.invoice",
    fields: {
        dteType: f.text("dte_type_display", { label: "Documento" }),
        folio: f.code((i) => i.display_id ?? i.number ?? null, { label: "Folio" }),
        date: f.date("date", { label: "Fecha" }),
        partner: f.text((i) => i.supplier_name || i.partner_name, { label: "Proveedor" }),
        hub: f.hubStatus((i) => i, { label: "Estado", entity: "billing.invoice", caption: (i) => ({ status: i.status, label: i.status_display }) }),
        total: f.money(signed, { label: "Total" }),
    },
    // ADR-0158 §3. Free text goes to `search` (contact name / RUT). No `sort`: the invoices endpoint has no
    // server ordering.
    query: {
        search: { placeholder: "Buscar notas por proveedor o RUT…", scopes: [{ field: "folio", param: "number" }] },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_from", paramTo: "date_to" },
            status: { label: "Estado", control: "single", options: [{ value: "DRAFT", label: "Borrador (folio pendiente)" }, { value: "POSTED", label: "Emitido" }, { value: "CANCELLED", label: "Anulado" }] },
            payment_status: { label: "Pago", control: "single", options: [{ value: "UNPAID", label: "Pendiente" }, { value: "PARTIAL", label: "Parcial" }, { value: "PAID", label: "Pagado" }] },
            total: { field: "total", control: "range", paramFrom: "total_min", paramTo: "total_max" },
        },
        groupBy: { fields: ["date", "hub"] },
    },
}))

export const purchaseNoteViews = purchaseNoteEntity.views({
    table: { columns: ["dteType", "folio", "date", "partner", "hub", "total"], primary: "folio" },
    card: {
        rail: { status: (r) => (r.status === "CANCELLED" ? "CANCELLED" : r.status === "DRAFT" ? "DRAFT" : isInvoiceCompleted(r) ? "SUCCESS" : "CONFIRMED") },
        title: "folio",
        subtitle: ["dteType", "partner", "date"],
        trailing: ["hub"],
        footer: { value: "total", align: "end" },
        media: { tone: (i) => (i.dte_type === "NOTA_CREDITO" ? "destructive" : i.dte_type === "NOTA_DEBITO" ? "warning" : "default") },
    },
})
