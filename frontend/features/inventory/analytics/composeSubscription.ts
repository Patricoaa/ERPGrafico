import type { ProductSubscriptionAnalysis } from "./subscriptionAnalysis.types"

export const PRICE_INCREASE_THRESHOLD = 5
export const ENDING_SOON_DAYS = 30

export type SubscriptionFindingId = "price_increase" | "amount_mismatch" | "overdue" | "ending_soon" | "paused"

export interface SubscriptionFinding {
    id: SubscriptionFindingId
    message: string
}

export interface SubscriptionComposition {
    findings: SubscriptionFinding[]
    sections: Array<"chart" | "subscriptions" | "payments">
}

const names = (rows: Array<{ supplier: string }>) => rows.map((r) => r.supplier).join(", ")

/** Decides findings and sections of the subscription tab. Pure. */
export function composeSubscription(data: ProductSubscriptionAnalysis): SubscriptionComposition {
    const rows = data.subscriptions
    const findings: SubscriptionFinding[] = []
    const increased = rows.filter((r) => r.change_pct !== null && r.change_pct >= PRICE_INCREASE_THRESHOLD)
    if (increased.length) {
        findings.push({
            id: "price_increase",
            message: `Subió el último pago: ${increased.map((r) => `${r.supplier} (+${(r.change_pct ?? 0).toFixed(1)} %)`).join(", ")}.`,
        })
    }
    const mismatched = rows.filter((r) => r.differs_from_amount)
    if (mismatched.length) {
        findings.push({ id: "amount_mismatch", message: `El último pago no coincide con el monto configurado: ${names(mismatched)}.` })
    }
    const overdue = rows.filter((r) => r.status === "ACTIVE" && r.days_to_payment !== null && r.days_to_payment < 0)
    if (overdue.length) {
        findings.push({ id: "overdue", message: `Pago vencido sin registrar: ${names(overdue)}.` })
    }
    const ending = rows.filter((r) => r.days_to_end !== null && r.days_to_end >= 0 && r.days_to_end <= ENDING_SOON_DAYS)
    if (ending.length) {
        findings.push({ id: "ending_soon", message: `Terminan en ${ENDING_SOON_DAYS} días o menos: ${names(ending)}.` })
    }
    const paused = rows.filter((r) => r.status === "PAUSED")
    if (paused.length) {
        findings.push({ id: "paused", message: `Suscripciones pausadas: ${names(paused)}.` })
    }

    const sections: SubscriptionComposition["sections"] = []
    if (data.series.points.length > 0) sections.push("chart")
    if (rows.length > 0) sections.push("subscriptions")
    if (data.payments.length > 0) sections.push("payments")
    return { findings, sections }
}
