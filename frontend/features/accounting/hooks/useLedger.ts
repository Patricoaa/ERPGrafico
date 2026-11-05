import { useQuery } from '@tanstack/react-query'
import { accountingApi } from '../api/accountingApi'
import type { LedgerData } from '../types'

import { LEDGER_QUERY_KEY } from './queryKeys'
import { staleTime } from '@/lib/query-config'

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
        staleTime: staleTime.standard, // 2 min
        // Sin cuenta o sin rango no hay libro que pedir: el backend responde 404 a `accounts/0/ledger/?start_date=`.
        enabled: accountId > 0 && sd !== '' && ed !== '',
    })
}
