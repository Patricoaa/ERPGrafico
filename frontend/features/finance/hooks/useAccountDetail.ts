import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'

export function useAccountDetail(accountId: string) {
    return useQuery({
        queryKey: ['account', accountId],
        queryFn: () => financeApi.getAccount(Number(accountId)),
    })
}
