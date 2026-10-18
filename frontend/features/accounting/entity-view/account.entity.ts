import { defineEntity } from "@/components/entity-view"
import type { AccountWithChildren } from "../utils/accountTree"

/**
 * Chart of accounts (ADR-0087, first tree entity). Replaces accountFields.ts + the hand-written
 * expandable code column. The hierarchy comes from `buildAccountTree` (parent → children, by code).
 */
export const accountEntity = defineEntity<AccountWithChildren>()((f) => ({
    label: "accounting.account",
    tree: { children: (a) => a.children },
    fields: {
        // The tree is already in code order; a text sort would put "1.10" before "1.2".
        code: f.code("code", { label: "Código", sortable: false }),
        name: f.text("name", { label: "Nombre" }),
        accountType: f.tags((a) => [a.account_type], { label: "Tipo", domain: "account_type" }),
        debitTotal: f.money("debit_total", { label: "Debe" }),
        creditTotal: f.money("credit_total", { label: "Haber" }),
        balance: f.money("balance", { label: "Saldo" }),
    },
}))

export const accountViews = accountEntity.views({
    table: { columns: ["code", "name", "accountType", "debitTotal", "creditTotal", "balance"], primary: "name" },
})
