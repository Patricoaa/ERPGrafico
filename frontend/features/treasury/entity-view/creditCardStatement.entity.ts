import { defineEntity } from "@/components/entity-view"
import type { CreditCardStatement } from "../card-statements/types"

export type { CreditCardStatement }

export const creditCardStatementEntity = defineEntity<CreditCardStatement>()((f) => ({
    title: "Estados de Cuenta TC",
    fields: {
        displayId: f.code("display_id", { label: "Folio" }),
        cardAccountName: f.text("card_account_name", { label: "Tarjeta" }),
        period: f.text(
            (s) => `${String(s.period_month).padStart(2, "0")}/${s.period_year}`,
            { label: "Período" },
        ),
        billedAmount: f.money(
            (s) => parseFloat(s.billed_amount),
            { label: "Facturado" },
        ),
        cutOffDate: f.date("cut_off_date", { label: "Cierre" }),
        dueDate: f.date("due_date", { label: "Vencimiento" }),
        status: f.status(
            (s) => ({ status: s.status, label: s.status_display }),
            { label: "Estado" },
        ),
        paidAt: f.date("paid_at", { label: "Pagado el" }),
        paymentAccountName: f.text("payment_account_name", { label: "Cuenta de pago" }),
        notes: f.text("notes", { label: "Notas" }),
    },
    // ADR-0158 §3, client mode. `bank` / `card` take their options from the screen; without a card the list
    // shows every card (or, inside one bank, its first card).
    query: {
        search: { placeholder: "Buscar por folio o monto…" },
        filters: {
            bank: { label: "Banco", control: "single", options: "remote" },
            card: { field: "cardAccountName", control: "single", options: "remote" },
            cutoff_date: { field: "cutOffDate", control: "date", paramFrom: "cutoff_from", paramTo: "cutoff_to" },
        },
        sort: { fields: ["cutOffDate", "displayId", "cardAccountName", "billedAmount", "dueDate", "status"], default: "-cutOffDate" },
        groupBy: { fields: ["status", "period", "cardAccountName"] },
    },
}))

export const creditCardStatementViews = creditCardStatementEntity.views({
    table: {
        columns: ["displayId", "cardAccountName", "period", "billedAmount", "cutOffDate", "dueDate", "status"],
        primary: "cardAccountName",
    },
    card: {
        rail: { status: (s) => s.status },
        title: "cardAccountName",
        subtitle: ["displayId", "period"],
        meta: ["cutOffDate", "dueDate"],
        trailing: ["status", "billedAmount"],
    },
})
