import { useQuery } from '@tanstack/react-query'
import { treasuryApi } from '../api/treasuryApi'
import { BANK_STATEMENTS_KEYS } from './queryKeys'

export function useBankStatement<T = Record<string, unknown>>(id: number | null, enabled = true) {
    const { data: statement, isLoading, isError } = useQuery<T>({
        queryKey: BANK_STATEMENTS_KEYS.detail(id as number),
        queryFn: () => treasuryApi.getStatement(id as number) as Promise<T>,
        enabled: !!id && enabled,
    })

    return { statement, isLoading, isError }
}
