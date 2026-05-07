import { useSuspenseQuery } from '@tanstack/react-query'
import { accountingApi } from '../api/accountingApi'
import type { LedgerData } from '../types'

export const LEDGER_QUERY_KEY = 'ledger'

export function useLedger(
    accountId: number,
    startDate: string,
    endDate: string
) {
    return useSuspenseQuery<LedgerData>({
        queryKey: [LEDGER_QUERY_KEY, accountId, startDate, endDate],
        queryFn: () => accountingApi.getLedger(accountId, startDate, endDate),
    })
}
