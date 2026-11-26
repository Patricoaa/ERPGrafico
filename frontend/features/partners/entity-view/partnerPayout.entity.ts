import { defineEditable, defineEntity } from "@/components/entity-view"
import type { Partner } from "@/features/contacts"

/**
 * Partner payouts as "amount to process per partner" (ADR-0087 P1): paying pending dividends of a
 * distribution, and mobilizing retained earnings into dividends or reinvestment.
 */

// ─── Mass dividend payment ───────────────────────────────────────────────────
export interface PendingDividendRow {
    partner: number
    partner_name: string
    pendingAmount: number
}

export const pendingDividendEntity = defineEntity<PendingDividendRow>()((f) => ({
    title: "Dividendo pendiente",
    rowId: (r) => r.partner,
    fields: {
        partner: f.text("partner_name", { label: "Socio" }),
        pending: f.money("pendingAmount", { label: "Pendiente" }),
    },
}))

export const massPaymentEditable = defineEditable(pendingDividendEntity, {
    rowKey: (r) => r.partner,
    context: ["partner", "pending"],
    inputs: {
        amount: {
            kind: "money",
            header: "A pagar",
            label: (r) => `Monto a pagar — ${r.partner_name}`,
            max: (r) => r.pendingAmount,
            initial: (r) => r.pendingAmount,
        },
    },
    footer: { sum: ["amount"] },
    bulk: ["fillToMax", "clear"],
    bulkLabels: { fillToMax: "Pagar totalidad", clear: "Limpiar todo" },
})

// ─── Retained earnings mobilization ──────────────────────────────────────────
export const availableEarningsOf = (p: Partner) => parseFloat(p.partner_earnings_balance || "0")

export const retainedEarningsEntity = defineEntity<Partner>()((f) => ({
    title: "Utilidades retenidas",
    fields: {
        partner: f.text("name", { label: "Socio" }),
        available: f.money(availableEarningsOf, { label: "Retenidas disponibles" }),
    },
}))

/** Each amount is capped by the available balance; the screen checks that both together fit too. */
export const mobilizeEarningsEditable = defineEditable(retainedEarningsEntity, {
    rowKey: (p) => p.id,
    context: ["partner", "available"],
    inputs: {
        dividend: { kind: "money", header: "A dividendos", label: (p) => `A dividendos — ${p.name}`, max: availableEarningsOf },
        reinvest: { kind: "money", header: "A reinversión", label: (p) => `A reinversión — ${p.name}`, max: availableEarningsOf },
    },
    footer: { sum: ["dividend", "reinvest"] },
})
