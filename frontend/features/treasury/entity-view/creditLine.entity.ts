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
