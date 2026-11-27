import { defineEntity, toNumber } from "@/components/entity-view"
import type { CreditLine } from "../credit-lines/types"

/** Bank credit line (ADR-0087 oleada A3). Replaces creditLineFields.ts + inline action buttons + renderCard children. */
export const creditLineEntity = defineEntity<CreditLine>()((f) => ({
    label: "treasury.creditline",
    fields: {
        code: f.code((c) => c.code || null, { label: "Código" }),
        accountName: f.text("account_name", { label: "Cuenta" }),
        status: f.status((c) => ({ status: c.status, label: c.status_display }), { label: "Estado" }),
        creditLimit: f.money("credit_limit", { label: "Límite" }),
        usedAmount: f.money("used_amount", { label: "Utilizado" }),
        availableAmount: f.money("available_amount", { label: "Disponible" }),
        utilizationRate: f.number((c) => toNumber(c.utilization_rate), { label: "Uso %", decimals: 1, suffix: "%" }),
    },
    // ADR-0158 §3, client mode: rows filter (`search.filterFn`) and sort in the browser.
    query: {
        search: { placeholder: "Buscar por código, cuenta o límite…" },
        filters: {
            status: {
                field: "status",
                control: "single",
                options: [
                    { value: "ACTIVE", label: "Activa" },
                    { value: "EXPIRED", label: "Vencida" },
                    { value: "SUSPENDED", label: "Suspendida" },
                    { value: "CANCELED", label: "Cancelada" },
                ],
            },
        },
        sort: { fields: ["code", "accountName", "status", "creditLimit", "usedAmount", "availableAmount", "utilizationRate"] },
        groupBy: { fields: ["status"] },
        views: [
            { id: "all", label: "Todas" },
            { id: "active", label: "Activas", filters: { status: "ACTIVE" } },
            { id: "expired", label: "Vencidas", filters: { status: "EXPIRED" } },
            { id: "suspended", label: "Suspendidas", filters: { status: "SUSPENDED" } },
            { id: "canceled", label: "Canceladas", filters: { status: "CANCELED" } },
        ],
    },
}))

export const creditLineViews = creditLineEntity.views({
    table: { columns: ["code", "accountName", "status", "creditLimit", "usedAmount", "availableAmount", "utilizationRate"] },
    card: {
        title: "accountName",
        subtitle: ["code"],
        trailing: ["status"],
        body: { kind: "metrics", fields: ["creditLimit", "usedAmount", "availableAmount", "utilizationRate"] },
    },
})
