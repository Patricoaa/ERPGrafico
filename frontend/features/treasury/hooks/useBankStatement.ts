import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { BANK_STATEMENTS_KEYS } from './queryKeys'

/** Forma real de `GET /treasury/statements/{id}/` (BankStatementSerializer). */
export interface BankStatementData {
    id: number
    display_id: string
    treasury_account: number
    treasury_account_name: string
    status: 'DRAFT' | 'CONFIRMED' | 'CANCELLED'
    state_display?: string
    statement_date: string
    opening_balance: string
    closing_balance: string
    notes?: string
    total_lines: number
    reconciled_lines: number
    touched_lines?: number
    reconciliation_progress: number
    has_file: boolean
    file_name: string | null
    imported_at: string
    imported_by_name: string
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
