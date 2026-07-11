import { useMemo } from "react"
import type { Partner } from "@/features/contacts"

export interface PartnerAnalyticsData {
    totalNetEquity: number
    totalContributions: number
    totalPaidIn: number
    totalPending: number
    totalExcess: number
    totalWithdrawals: number
    totalEarnings: number
    totalDividendsPayable: number
    partnerCount: number
    equityDistribution: Array<{ id: string; value: number }>
    capitalComparison: Array<{ name: string; paid: number; pending: number }>
    balanceComposition: Array<{
        name: string
        equity: number
        earnings: number
        pending: number
        withdrawals: number
    }>
    partnerRanking: Array<{ name: string; netEquity: number }>
}

export function usePartnerAnalyticsData(partners: Partner[]): PartnerAnalyticsData {
    return useMemo(() => {
        const safe = Array.isArray(partners) ? partners : []

        const totalNetEquity = safe.reduce((s, p) => s + Number(p.partner_net_equity || 0), 0)
        const totalContributions = safe.reduce((s, p) => s + Number(p.partner_total_contributions || 0), 0)
        const totalPaidIn = safe.reduce((s, p) => s + Number(p.partner_total_paid_in || 0), 0)
        const totalPending = safe.reduce((s, p) => s + Number(p.partner_pending_capital || 0), 0)
        const totalExcess = safe.reduce((s, p) => s + Number(p.partner_excess_capital || 0), 0)
        const totalWithdrawals = safe.reduce((s, p) => s + Number(p.partner_provisional_withdrawals_balance || 0), 0)
        const totalEarnings = safe.reduce((s, p) => s + Number(p.partner_earnings_balance || 0), 0)
        const totalDividendsPayable = safe.reduce((s, p) => s + Number(p.partner_dividends_payable_balance || 0), 0)

        const equityDistribution = safe
            .filter((p) => Number(p.partner_net_equity) > 0)
            .map((p) => ({ id: p.name, value: Number(p.partner_net_equity) }))

        const capitalComparison = safe.map((p) => ({
            name: p.name.split(" ")[0],
            paid: Number(p.partner_total_paid_in),
            pending: Number(p.partner_pending_capital),
        }))

        const balanceComposition = safe.map((p) => ({
            name: p.name.split(" ")[0],
            equity: Number(p.partner_net_equity),
            earnings: Number(p.partner_earnings_balance),
            pending: Number(p.partner_pending_capital),
            withdrawals: Number(p.partner_provisional_withdrawals_balance),
        }))

        const partnerRanking = safe
            .map((p) => ({ name: p.name, netEquity: Number(p.partner_net_equity) }))
            .sort((a, b) => b.netEquity - a.netEquity)

        return {
            totalNetEquity,
            totalContributions,
            totalPaidIn,
            totalPending,
            totalExcess,
            totalWithdrawals,
            totalEarnings,
            totalDividendsPayable,
            partnerCount: safe.length,
            equityDistribution,
            capitalComparison,
            balanceComposition,
            partnerRanking,
        }
    }, [partners])
}
