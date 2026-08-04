import type { Partner } from "../types/partner"

const toNumber = (value: string | number | null | undefined): number => {
    if (value === null || value === undefined) return 0
    const n = typeof value === "number" ? value : Number(value)
    return Number.isFinite(n) ? n : 0
}

const roundPct = (value: number): string => String(Math.round(value * 10000) / 100)

export function totalNetEquity(partners: readonly Partner[]): number {
    return partners.reduce((sum, p) => sum + toNumber(p.partner_net_equity), 0)
}

export function totalSubscribedCapital(partners: readonly Partner[]): number {
    return partners.reduce((sum, p) => sum + toNumber(p.partner_total_contributions), 0)
}

export function netEquityPercentages(partners: readonly Partner[]): Record<number, string> {
    const total = totalNetEquity(partners)
    const result: Record<number, string> = {}
    for (const p of partners) {
        const equity = toNumber(p.partner_net_equity)
        result[p.id] = total > 0 && equity > 0 ? roundPct(equity / total) : "0"
    }
    return result
}

export function subscribedPercentages(partners: readonly Partner[]): Record<number, string> {
    const total = totalSubscribedCapital(partners)
    const result: Record<number, string> = {}
    for (const p of partners) {
        const subscribed = toNumber(p.partner_total_contributions)
        result[p.id] = total > 0 && subscribed > 0 ? roundPct(subscribed / total) : "0"
    }
    return result
}
