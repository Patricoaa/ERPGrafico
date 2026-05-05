import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import type { BankStatement, ReconciliationRule, TreasuryAccount, PaginatedResponse, BankStatementLine, ReconciliationSystemItem } from '../types'
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

export function useReconciliationSettingsQuery(accountId?: number | string) {
    return useQuery({
        queryKey: reconciliationKeys.settings(accountId),
        queryFn: async () => {
            const res = await api.get('/treasury/reconciliation-settings/for_account/', {
                params: { treasury_account_id: accountId }
            })
            return res.data
        },
        enabled: !!accountId
    })
}

export interface QueryPaginationParams {
    page?: number
    pageSize?: number
    search?: string
    date_from?: string
    date_to?: string
    amount_min?: number
    amount_max?: number
    type?: string
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

export function useUnreconciledLinesQuery(statementId: number, params: QueryPaginationParams = {}) {
    return useQuery({
        queryKey: reconciliationKeys.unreconciledLines(statementId, params),
        queryFn: async ({ signal }) => {
            const res = await api.get<PaginatedResponse<BankStatementLine>>('/treasury/statement-lines/', {
                params: {
                    statement: statementId,
                    reconciliation_state: 'UNRECONCILED,EXCLUDED',
                    page: params.page || 1,
                    page_size: params.pageSize || 50,
                    search: params.search,
                    date_from: params.date_from,
                    date_to: params.date_to,
                    amount_min: params.amount_min,
                    amount_max: params.amount_max,
                    direction: params.type
                },
                signal
            })
            return res.data // { count, next, previous, results }
        },
        enabled: !!statementId
    })
}

export function useUnreconciledPaymentsQuery(treasuryAccountId: number, params: QueryPaginationParams = {}) {
    return useQuery({
        queryKey: reconciliationKeys.unreconciledPayments(treasuryAccountId, params),
        queryFn: async ({ signal }) => {
            const paymentsRes = await api.get<PaginatedResponse<ReconciliationSystemItem>>('/treasury/payments/', {
                params: {
                    is_reconciled: 'False',
                    treasury_account: treasuryAccountId,
                    page: params.page || 1,
                    page_size: params.pageSize || 50,
                    date_from: params.date_from,
                    date_to: params.date_to,
                    amount_min: params.amount_min,
                    amount_max: params.amount_max,
                    direction: params.type
                },
                signal
            })

            const paymentsData = paymentsRes.data.results || paymentsRes.data

            const payments = Array.isArray(paymentsData) ? paymentsData.map((p: any) => {
                let contactName = p.partner_name || 'Particular'
                
                if (p.movement_type === 'TRANSFER') {
                    contactName = p.is_inbound ? (p.from_account_name || 'Cuenta Origen') : (p.to_account_name || 'Cuenta Destino')
                } else if (p.movement_type === 'ADJUSTMENT') {
                    contactName = p.justify_reason_display || p.notes || 'Ajuste Manual'
                }

                return {
                    ...p,
                    contact_name: contactName
                }
            }) : []

            return {
                results: payments,
                count: paymentsRes.data.count || payments.length
            }
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
export function useReconciledLinesQuery(statementId: number, params: QueryPaginationParams = {}) {
    return useQuery({
        queryKey: reconciliationKeys.reconciledLines(statementId, params),
        queryFn: async ({ signal }) => {
            const res = await api.get<PaginatedResponse<BankStatementLine>>('/treasury/statement-lines/', {
                params: {
                    statement: statementId,
                    reconciliation_state: 'RECONCILED',
                    page: params.page || 1,
                    page_size: params.pageSize || 50,
                    search: params.search,
                    date_from: params.date_from,
                    date_to: params.date_to,
                    amount_min: params.amount_min,
                    amount_max: params.amount_max,
                    direction: params.type
                },
                signal
            })
            return res.data
        },
        enabled: !!statementId
    })
}
