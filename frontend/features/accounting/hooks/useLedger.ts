import { useQuery } from '@tanstack/react-query'
import { accountingApi } from '../api/accountingApi'
import type { LedgerData } from '../types'

import { LEDGER_QUERY_KEY } from './queryKeys'

export { LEDGER_QUERY_KEY }

export function useLedger(
    accountId: number,
    startDate: string,
    endDate: string
) {
    return useQuery<LedgerData>({
        queryKey: [LEDGER_QUERY_KEY, accountId, startDate, endDate],
        queryFn: () => accountingApi.getLedger(accountId, startDate, endDate),
        staleTime: 2 * 60 * 1000, // 2 min
    })
}
