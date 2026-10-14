import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import { FINANCE_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'

export function useAccountDetail(accountId: string) {
    return useQuery({
        queryKey: FINANCE_KEYS.accounts.detail(Number(accountId)),
        queryFn: () => financeApi.getAccount(Number(accountId)),
        staleTime: staleTime.stable,
    })
}
