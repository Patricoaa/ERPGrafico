import { useQuery } from '@tanstack/react-query'
import { accountingApi } from '../api/accountingApi'
import type { LedgerData } from '../types'

import { LEDGER_QUERY_KEY } from './queryKeys'

export { LEDGER_QUERY_KEY }

export function useLedger(
    accountId: number,
    startDate?: string,
    endDate?: string
) {
    const sd = startDate ?? ''
    const ed = endDate ?? ''
    return useQuery<LedgerData>({
        queryKey: [LEDGER_QUERY_KEY, accountId, sd, ed],
        queryFn: () => accountingApi.getLedger(accountId, sd, ed),
        staleTime: 2 * 60 * 1000, // 2 min
    })
}
