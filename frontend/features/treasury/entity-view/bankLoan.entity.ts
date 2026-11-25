import { defineEntity, formatNumber, toNumber } from "@/components/entity-view"
import type { BankLoan } from "../loans/types"

/** "1,50% anual"; null (→ "—") without a rate, never "—% anual". */
const rate = (l: BankLoan): string | null =>
    toNumber(l.interest_rate) === null ? null : `${formatNumber(l.interest_rate, 2)}% ${l.rate_basis_display?.toLowerCase() ?? ""}`.trim()

/** Bank loan (ADR-0087 oleada A3). Replaces loanFields.tsx + renderCard. */
export const bankLoanEntity = defineEntity<BankLoan>()((f) => ({
    label: "treasury.bankloan",
    fields: {
        displayId: f.code("display_id", { label: "ID Interno" }),
        lenderName: f.text("lender_name", { label: "Banco" }),
        currency: f.text("currency", { label: "Moneda" }),
        principal: f.money("principal", { label: "Capital" }),
        interestRate: f.text(rate, { label: "Tasa", align: "end" }),
        outstandingBalance: f.money("outstanding_balance", { label: "Saldo Insoluto" }),
        termMonths: f.number("term_months", { label: "Plazo", suffix: "meses" }),
        nextDueDate: f.date("next_due_date", { label: "Próx. Vto." }),
        status: f.status((l) => ({ status: l.status, label: l.status_display }), { label: "Estado" }),
    },
    // ADR-0158 §3, client mode: the server filters by lender; status and text filter in the browser.
    query: {
        search: { placeholder: "Buscar por ID, N° préstamo o banco…" },
        filters: {
            lender: { label: "Banco", control: "single", options: "remote" },
            loan_status: { field: "status", control: "single", options: [{ value: "active", label: "Activos" }, { value: "completed", label: "Finalizados" }] },
        },
        sort: { fields: ["nextDueDate", "displayId", "lenderName", "principal", "outstandingBalance", "termMonths", "status"] },
        groupBy: { fields: ["status"] },
        // The first view is applied on load: without a status filter the list shows active loans.
        views: [
            { id: "active", label: "Activos", filters: { loan_status: "active" } },
            { id: "completed", label: "Finalizados", filters: { loan_status: "completed" } },
        ],
    },
}))

export const bankLoanViews = bankLoanEntity.views({
    table: { columns: ["displayId", "lenderName", "currency", "principal", "interestRate", "outstandingBalance", "termMonths", "nextDueDate", "status"] },
    card: {
        title: "displayId",
        subtitle: ["lenderName", "interestRate"],
        meta: ["nextDueDate", "termMonths"],
        trailing: ["status"],
        body: { kind: "metrics", fields: ["principal", "outstandingBalance"] },
    },
})
