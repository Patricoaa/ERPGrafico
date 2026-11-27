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
        isActive: f.status((a) => (a.is_active ? { status: "active", label: "Activo" } : { status: "inactive", label: "Archivado" }), { label: "Estado" }),
    },
    // ADR-0158 §3, client mode: the server filters, the browser sorts the tree. No grouping: the
    // hierarchy is the grouping.
    query: {
        search: { placeholder: "Buscar por cuenta o código…" },
        filters: {
            account_type: {
                field: "accountType",
                control: "single",
                options: [
                    { value: "ASSET", label: "Activo" },
                    { value: "LIABILITY", label: "Pasivo" },
                    { value: "EQUITY", label: "Patrimonio" },
                    { value: "INCOME", label: "Ingresos" },
                    { value: "EXPENSE", label: "Gastos" },
                ],
            },
            is_active: { field: "isActive", control: "single", options: [{ value: "true", label: "Activo" }, { value: "false", label: "Archivado" }] },
        },
        sort: { fields: ["name", "accountType", "debitTotal", "creditTotal", "balance", "isActive"] },
        views: [
            { id: "all", label: "Todas" },
            { id: "active", label: "Activas", filters: { is_active: "true" } },
            { id: "archived", label: "Archivadas", filters: { is_active: "false" } },
        ],
    },
}))

export const accountViews = accountEntity.views({
    table: { columns: ["code", "name", "accountType", "isActive", "debitTotal", "creditTotal", "balance"], primary: "name" },
})
