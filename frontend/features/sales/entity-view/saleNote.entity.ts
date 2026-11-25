import { defineEntity } from "@/components/entity-view"
import { isInvoiceCompleted } from "@/lib/workflow-status"
import type { SaleNote } from "../types"

/** Credit notes reduce the balance: shown with sign (02 §3 #3: NC displayed positive). */
const signed = (n: SaleNote): number => (n.dte_type === "NOTA_CREDITO" ? -Math.abs(Number(n.total)) : Number(n.total))

/**
 * Sales notes / invoices — the "notes" mode of the sales orders screen (ADR-0087 lote 2b).
 * No `orderBy`: the invoices endpoint has no server ordering yet, so a paginated list is not
 * reordered page by page (Pd-backend).
 */
export const saleNoteEntity = defineEntity<SaleNote>()((f) => ({
    label: "billing.invoice",
    fields: {
        dteType: f.text("dte_type_display", { label: "Documento" }),
        folio: f.code((n) => n.display_id ?? n.number ?? null, { label: "Número" }),
        date: f.date("date", { label: "Fecha", groupKey: "date" }),
        // The serializer sends `partner_id` + `partner_name` (sale order customer, or the note's contact).
        // Without an id the name is still shown (as plain text), as the former list did.
        customer: f.contact((n) => {
            const name = n.partner_name || n.customer_name
            return name ? { id: n.partner_id ?? 0, name } : null
        }, { label: "Cliente", groupKey: "contact" }),
        hub: f.hubStatus((n) => n, { label: "Estado", groupKey: "status", entity: "billing.invoice", caption: (n) => ({ status: n.status, label: n.status_display }) }),
        total: f.money(signed, { label: "Total" }),
    },
    // ADR-0158 §3. No `sort`: the invoices endpoint has no server ordering yet.
    query: {
        search: {
            placeholder: "Buscar notas…",
            scopes: [
                { field: "customer", param: "partner_name", suggestionsUrl: "sales/orders/filter-suggestions/" },
                { field: "folio", param: "number" },
            ],
        },
        filters: {
            date: { field: "date", control: "date", paramFrom: "date_from", paramTo: "date_to" },
            status: { field: "hub", control: "multi", param: "status__in", options: [{ value: "DRAFT", label: "Borrador (folio pendiente)" }, { value: "POSTED", label: "Emitido" }, { value: "CANCELLED", label: "Anulado" }] },
            payment_status: { label: "Pago", control: "single", options: [{ value: "UNPAID", label: "Pendiente" }, { value: "PARTIAL", label: "Parcial" }, { value: "PAID", label: "Pagado" }] },
            total: { field: "total", control: "range", paramFrom: "total_min", paramTo: "total_max" },
        },
        groupBy: { fields: ["date", "customer", "hub"] },
        views: [
            { id: "all", label: "Todas" },
            { id: "unpaid", label: "Por cobrar", filters: { status: "POSTED", payment_status: "UNPAID" } },
            { id: "drafts", label: "Borradores", filters: { status: "DRAFT" } },
        ],
    },
}))

export const saleNoteViews = saleNoteEntity.views({
    table: { columns: ["dteType", "folio", "date", "customer", "hub", "total"], primary: "folio" },
    card: {
        rail: { status: (r) => (r.status === "CANCELLED" ? "CANCELLED" : r.status === "DRAFT" ? "DRAFT" : isInvoiceCompleted(r) ? "SUCCESS" : "CONFIRMED") },
        title: "folio",
        subtitle: ["dteType", "customer", "date"],
        trailing: ["hub"],
        footer: { value: "total", align: "end" },
        media: { tone: (n) => (n.dte_type === "NOTA_CREDITO" ? "destructive" : n.dte_type === "NOTA_DEBITO" ? "warning" : "default") },
    },
})
