import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import type { StatementParams } from '../api/financeApi'
import { FINANCE_KEYS } from './queryKeys'
import { staleTime } from '@/lib/query-config'

export function useStatements(params: StatementParams) {
    const { data: balanceSheet, isLoading: isLoadingBS, isError: isErrorBS, refetch: refetchBS } = useQuery({
        queryKey: FINANCE_KEYS.statements.balanceSheet(params),
        queryFn: () => financeApi.getBalanceSheet(params),
        staleTime: staleTime.stable,
        placeholderData: (prev) => prev,
    })

    const { data: incomeStatement, isLoading: isLoadingPL, isError: isErrorPL, refetch: refetchPL } = useQuery({
        queryKey: FINANCE_KEYS.statements.incomeStatement(params),
        queryFn: () => financeApi.getIncomeStatement(params),
        staleTime: staleTime.stable,
        placeholderData: (prev) => prev,
    })

    const { data: cashFlow, isLoading: isLoadingCF, isError: isErrorCF, refetch: refetchCF } = useQuery({
        queryKey: FINANCE_KEYS.statements.cashFlow(params),
        queryFn: () => financeApi.getCashFlow(params),
        staleTime: staleTime.stable,
        placeholderData: (prev) => prev,
    })

    const refetch = async () => {
        await Promise.all([refetchBS(), refetchPL(), refetchCF()])
    }

    return {
        balanceSheet,
        incomeStatement,
        cashFlow,
        refetch,
        isLoading: isLoadingBS || isLoadingPL || isLoadingCF,
        isError: isErrorBS || isErrorPL || isErrorCF,
    }
}
