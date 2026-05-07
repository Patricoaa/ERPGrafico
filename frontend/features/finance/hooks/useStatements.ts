import { useSuspenseQuery } from '@tanstack/react-query'
import api, { pollTask } from '@/lib/api'

export const STATEMENTS_QUERY_KEY = ['statements']

interface StatementParams {
    start_date?: string
    end_date?: string
    comp_start_date?: string
    comp_end_date?: string
    showComparison?: boolean
}

async function fetchStatement(endpoint: string, params: StatementParams) {
    const queryParams: any = {
        start_date: params.start_date,
        end_date: params.end_date,
        is_async: true
    }

    if (params.showComparison && params.comp_start_date && params.comp_end_date) {
        queryParams.comp_start_date = params.comp_start_date
        queryParams.comp_end_date = params.comp_end_date
    }

    const res = await api.get(endpoint, { params: queryParams })
    return res.data.task_id ? pollTask(res.data.task_id) : res.data
}

export function useStatements(params: StatementParams) {
    const { data: balanceSheet, refetch: refetchBS } = useSuspenseQuery({
        queryKey: [...STATEMENTS_QUERY_KEY, 'balance-sheet', params],
        queryFn: () => fetchStatement('finances/api/balance-sheet/', params),
    })

    const { data: incomeStatement, refetch: refetchPL } = useSuspenseQuery({
        queryKey: [...STATEMENTS_QUERY_KEY, 'income-statement', params],
        queryFn: () => fetchStatement('finances/api/income-statement/', params),
    })

    const { data: cashFlow, refetch: refetchCF } = useSuspenseQuery({
        queryKey: [...STATEMENTS_QUERY_KEY, 'cash-flow', params],
        queryFn: () => fetchStatement('finances/api/cash-flow/', params),
    })

    const refetch = async () => {
        await Promise.all([refetchBS(), refetchPL(), refetchCF()])
    }

    return {
        balanceSheet,
        incomeStatement,
        cashFlow,
        refetch
    }
}
