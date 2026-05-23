import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../api/financeApi'
import type { StatementParams } from '../api/financeApi'

export const STATEMENTS_QUERY_KEY = ['statements']

export function useStatements(params: StatementParams) {
    const { data: balanceSheet, isLoading: isLoadingBS, refetch: refetchBS } = useQuery({
        queryKey: [...STATEMENTS_QUERY_KEY, 'balance-sheet', params],
        queryFn: () => financeApi.getBalanceSheet(params),
        staleTime: 5 * 60 * 1000,
    })

    const { data: incomeStatement, isLoading: isLoadingPL, refetch: refetchPL } = useQuery({
        queryKey: [...STATEMENTS_QUERY_KEY, 'income-statement', params],
        queryFn: () => financeApi.getIncomeStatement(params),
        staleTime: 5 * 60 * 1000,
    })

    const { data: cashFlow, isLoading: isLoadingCF, refetch: refetchCF } = useQuery({
        queryKey: [...STATEMENTS_QUERY_KEY, 'cash-flow', params],
        queryFn: () => financeApi.getCashFlow(params),
        staleTime: 5 * 60 * 1000,
    })

    const refetch = async () => {
        await Promise.all([refetchBS(), refetchPL(), refetchCF()])
    }

    return {
        balanceSheet,
        incomeStatement,
        cashFlow,
        refetch,
        isLoading: isLoadingBS || isLoadingPL || isLoadingCF
    }
}
