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
