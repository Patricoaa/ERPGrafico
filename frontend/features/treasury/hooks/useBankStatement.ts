import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { BANK_STATEMENTS_KEYS } from './queryKeys'

export function useBankStatement(id: number | null, enabled = true) {
    const { data: statement, isLoading } = useQuery({
        queryKey: BANK_STATEMENTS_KEYS.detail(id!),
        queryFn: () => treasuryApi.getStatement(id!),
        enabled: !!id && enabled,
    })

    return { statement, isLoading }
}
