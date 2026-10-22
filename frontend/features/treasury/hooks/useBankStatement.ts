import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { BANK_STATEMENTS_KEYS } from './queryKeys'

export interface BankStatementData {
    id: number
    display_id: string
    treasury_account_name: string
    status: string
    opening_balance: number
    closing_balance: number
    reconciliation_progress: number
    date: string
}

export function useBankStatement(id: number | null, enabled = true) {
    const { data: statement, isLoading, isError, refetch } = useQuery<BankStatementData>({
        queryKey: BANK_STATEMENTS_KEYS.detail(id as number),
        queryFn: () => treasuryApi.getStatement(id as number) as unknown as Promise<BankStatementData>,
        enabled: !!id && enabled,
        placeholderData: (prev) => prev,
    })

    return { statement, isLoading, isError, refetch }
}
