import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { BANKS_KEYS } from './queryKeys'

export interface BankOverviewMaturityItem {
    type: string
    label: string
    due_date: string
    amount: number
    entity_id: number
    display_id: string
}

export interface BankOverviewData {
    bank: { id: number; name: string; code: string | null }
    accounts: Array<{
        id: number
        name: string
        account_type: string
        account_type_display: string
        current_balance: number
        currency: string
    }>
    summary: {
        total_accounts: number
        card_debt: number
        portfolio_checks: number
        issued_checks: number
        active_loan_count: number
        total_loan_debt: number
    }
    upcoming_maturities: BankOverviewMaturityItem[]
}

export function useBankOverview(bankId: number | null) {
    return useQuery({
        queryKey: [...BANKS_KEYS.all, 'overview', bankId],
        queryFn: () => treasuryApi.getBankOverview(bankId!),
        enabled: bankId != null,
        staleTime: 2 * 60 * 1000,
    })
}
