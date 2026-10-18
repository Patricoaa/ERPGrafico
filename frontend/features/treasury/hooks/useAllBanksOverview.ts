import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { BANKS_KEYS } from './queryKeys'
import { useBanks } from './useMasterData'
import { staleTime } from '@/lib/query-config'

export interface BankSummary {
    bank: { id: number; name: string; code: string | null }
    summary: {
        total_accounts: number
        card_count: number
        card_debt: number
        portfolio_checks: number
        issued_checks: number
        active_loan_count: number
        total_loan_debt: number
    }
}

/** Stable empty result: a fresh `[]` per render would invalidate every memo downstream. */
const NO_OVERVIEWS: BankSummary[] = []

export function useAllBanksOverview() {
    const { banks } = useBanks()

    const { data: overviews, isLoading } = useQuery({
        queryKey: [...BANKS_KEYS.all, 'all-overviews'],
        queryFn: async () => {
            const results = await Promise.all(
                banks.filter(b => b.is_active).map(async (bank) => {
                    try {
                        const overview = await treasuryApi.getBankOverview(bank.id)
                        return overview as unknown as BankSummary
                    } catch {
                        return null
                    }
                })
            )
            return results.filter((r): r is BankSummary => r !== null)
        },
        enabled: banks.length > 0,
        staleTime: staleTime.stable,
    })

    return { overviews: overviews ?? NO_OVERVIEWS, isLoading }
}
