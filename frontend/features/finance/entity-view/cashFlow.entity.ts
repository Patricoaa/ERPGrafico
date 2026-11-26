import { defineEntity } from "@/components/entity-view"
import type { CulpritAccount, MaturityItem } from "../types"
import "./financialStatement.entity"

/**
 * Cash flow side lists (ADR-0087), shown under the statement and in its integrity audit:
 * projected maturities and the unmapped accounts that explain a discrepancy.
 */

const MATURITY_TYPE: Record<string, string> = {
    LOAN_INSTALLMENT: "Cuota",
    CHECK_RECEIVED: "Cheque recibido",
    CHECK_ISSUED: "Cheque propio",
}

/** A maturity with its position: two maturities may share type, date and label. */
export interface MaturityRow extends MaturityItem {
    key: string
}

export const toMaturityRows = (items: readonly MaturityItem[]): MaturityRow[] => items.map((item, i) => ({ ...item, key: `${item.type}-${item.due_date}-${i}` }))

export const cashFlowMaturityEntity = defineEntity<MaturityRow>()((f) => ({
    title: "Vencimientos futuros",
    rowId: (m) => m.key,
    fields: {
        type: f.status((m) => ({
            status: m.type,
            label: MATURITY_TYPE[m.type] ?? "Tarjeta",
            intent: m.direction === "INBOUND" ? "success" : "destructive",
        }), { label: "Tipo", sortable: false }),
        label: f.text("label", { label: "Descripción", sortable: false }),
        dueDate: f.date("due_date", { label: "Vencimiento" }),
        amount: f.flow("amount", { label: "Monto", direction: (m) => (m.direction === "INBOUND" ? "inflow" : "outflow"), showIcon: false }),
    },
}))

export const cashFlowMaturityViews = cashFlowMaturityEntity.views({
    table: { columns: ["type", "label", "dueDate", "amount"], primary: "label" },
})

export const cashFlowCulpritEntity = defineEntity<CulpritAccount>()((f) => ({
    title: "Cuentas sin mapeo de flujo",
    rowId: (a) => a.code,
    fields: {
        account: f.value("statementAccount", (a) => ({ code: a.code, name: a.name }), { label: "Cuenta", sortable: false }),
        variation: f.money("variation", { label: "Variación" }),
    },
}))

export const cashFlowCulpritViews = cashFlowCulpritEntity.views({
    table: { columns: ["account", "variation"], primary: "account" },
})
