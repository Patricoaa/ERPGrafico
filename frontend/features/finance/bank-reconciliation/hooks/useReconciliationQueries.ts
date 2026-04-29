import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { BankStatement, ReconciliationRule, TreasuryAccount } from '../types'
import { reconciliationKeys } from './queryKeys'

export function useStatementsQuery() {
    return useQuery({
        queryKey: reconciliationKeys.statements(),
        queryFn: async () => {
            const res = await api.get('/treasury/statements/')
            return res.data as BankStatement[]
        }
    })
}

export function useStatementQuery(id: number, enabled: boolean = true) {
    return useQuery({
        queryKey: reconciliationKeys.statement(id),
        queryFn: async () => {
            const res = await api.get(`/treasury/statements/${id}/`)
            return res.data as BankStatement
        },
        enabled: enabled && !!id
    })
}

export function useAccountsQuery() {
    return useQuery({
        queryKey: reconciliationKeys.accounts(),
        queryFn: async () => {
            const res = await api.get('/treasury/accounts/')
            return res.data as TreasuryAccount[]
        }
    })
}

export function useRulesQuery() {
    return useQuery({
        queryKey: reconciliationKeys.rules(),
        queryFn: async () => {
            const res = await api.get('/treasury/reconciliation-rules/')
            return res.data as ReconciliationRule[]
        }
    })
}

export function useDashboardDataQuery(selectedAccount: string = 'all') {
    return useQuery({
        queryKey: reconciliationKeys.dashboard(selectedAccount),
        queryFn: async () => {
            const params = selectedAccount !== 'all' ? { treasury_account: selectedAccount } : {}
            const [kpiRes, trendRes, pendingRes] = await Promise.all([
                api.get('/treasury/reconciliation-reports/dashboard/', { params }),
                api.get('/treasury/reconciliation-reports/history/', { params }),
                api.get('/treasury/reconciliation-reports/pending/', { params })
            ])
            return {
                stats: kpiRes.data,
                trend: trendRes.data,
                pending: pendingRes.data
            }
        }
    })
}

export function useUnreconciledLinesQuery(statementId: number) {
    return useQuery({
        queryKey: reconciliationKeys.unreconciledLines(statementId),
        queryFn: async ({ signal }) => {
            const res = await api.get('/treasury/statement-lines/', {
                params: {
                    statement: statementId,
                    reconciliation_state: 'UNRECONCILED'
                },
                signal
            })
            return res.data
        },
        enabled: !!statementId
    })
}

export function useUnreconciledPaymentsQuery(treasuryAccountId: number) {
    return useQuery({
        queryKey: reconciliationKeys.unreconciledPayments(treasuryAccountId),
        queryFn: async ({ signal }) => {
            const [paymentsRes, batchesRes] = await Promise.all([
                api.get('/treasury/payments/', {
                    params: {
                        is_reconciled: 'False',
                        treasury_account: treasuryAccountId,
                        limit: 100
                    },
                    signal
                }),
                api.get('/treasury/terminal-batches/', {
                    params: {
                        status: 'SETTLED',
                        reconciliation_match__isnull: 'True'
                    },
                    signal
                })
            ])

            const payments = paymentsRes.data.results || paymentsRes.data
            const batches = (batchesRes.data.results || batchesRes.data).map((b: any) => ({
                id: b.id,
                display_id: b.display_id,
                amount: b.net_amount,
                date: b.sales_date,
                contact_name: b.supplier_name || 'Liquidación Terminal',
                is_batch: true
            }))

            return [...payments, ...batches]
        },
        enabled: !!treasuryAccountId
    })
}

export function useLineSuggestionsQuery(lineId: number, enabled: boolean) {
    return useQuery({
        queryKey: reconciliationKeys.lineSuggestions(lineId),
        queryFn: async ({ signal }) => {
            const res = await api.get(`/treasury/statement-lines/${lineId}/suggestions/`, { signal })
            return res.data.suggestions || []
        },
        enabled: enabled && !!lineId
    })
}

export function usePaymentSuggestionsQuery(paymentId: number, enabled: boolean) {
    return useQuery({
        queryKey: reconciliationKeys.paymentSuggestions(paymentId),
        queryFn: async ({ signal }) => {
            const res = await api.get(`/treasury/payments/${paymentId}/suggestions/`, { signal })
            return res.data.suggestions || []
        },
        enabled: enabled && !!paymentId
    })
}
