import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../../api/financeApi'
import type { BankStatement, TreasuryAccount, PaginatedResponse, BankStatementLine } from '../types'
import { reconciliationKeys } from './queryKeys'

export function useStatementsQuery(params?: Record<string, string>) {
    return useQuery({
        queryKey: reconciliationKeys.statements(),
        queryFn: () => financeApi.getStatements(params) as unknown as Promise<BankStatement[]>,
        staleTime: 2 * 60 * 1000,
    })
}

export function useStatementQuery(id: number, enabled: boolean = true) {
    return useQuery({
        queryKey: reconciliationKeys.statement(id),
        queryFn: () => financeApi.getStatement(id) as Promise<BankStatement>,
        staleTime: 2 * 60 * 1000,
        enabled: enabled && !!id
    })
}

export function useAccountsQuery() {
    return useQuery({
        queryKey: reconciliationKeys.accounts(),
        queryFn: () => financeApi.getReconciliationAccounts() as Promise<TreasuryAccount[]>,
        staleTime: 5 * 60 * 1000,
    })
}

export function useReconciliationSettingsQuery(accountId?: number | string) {
    return useQuery({
        queryKey: reconciliationKeys.settings(accountId ? Number(accountId) : undefined),
        queryFn: () => financeApi.getReconciliationSettings(accountId ? Number(accountId) : undefined),
        staleTime: 5 * 60 * 1000,
        enabled: !!accountId
    })
}

export interface QueryPaginationParams {
    [key: string]: unknown;
    page?: number
    pageSize?: number
    search?: string
    date_from?: string
    date_to?: string
    amount_min?: number
    amount_max?: number
    type?: string
}


export function useUnreconciledLinesQuery(statementId: number, params: QueryPaginationParams = {}) {
    return useQuery({
        queryKey: reconciliationKeys.unreconciledLines(statementId, params),
        queryFn: async ({ signal }) => {
            const data = await financeApi.getStatementLines({
                statement: statementId,
                reconciliation_state: 'UNRECONCILED,EXCLUDED',
                page: params.page || 1,
                page_size: params.pageSize || 50,
                search: params.search,
                date_from: params.date_from,
                date_to: params.date_to,
                amount_min: params.amount_min,
                amount_max: params.amount_max,
                direction: params.type,
            })
            return data as PaginatedResponse<BankStatementLine>
        },
        staleTime: 2 * 60 * 1000,
        enabled: !!statementId
    })
}

export function useUnreconciledPaymentsQuery(treasuryAccountId: number, params: QueryPaginationParams = {}) {
    return useQuery({
        queryKey: reconciliationKeys.unreconciledPayments(treasuryAccountId, params),
        queryFn: async ({ signal }) => {
            const paymentsData = await financeApi.getPayments({
                is_reconciled: 'False',
                treasury_account: treasuryAccountId,
                page: params.page || 1,
                page_size: params.pageSize || 50,
                date_from: params.date_from,
                date_to: params.date_to,
                amount_min: params.amount_min,
                amount_max: params.amount_max,
                direction: params.type,
            })
            const results = Array.isArray(paymentsData) ? paymentsData : ((paymentsData as { results?: unknown[] })?.results ?? [])
            const payments = Array.isArray(results) ? results.map((p: any) => {
                let contactName = p.partner_name || 'Particular'
                if (p.movement_type === 'TRANSFER') {
                    contactName = p.is_inbound ? (p.from_account_name || 'Cuenta Origen') : (p.to_account_name || 'Cuenta Destino')
                } else if (p.movement_type === 'ADJUSTMENT') {
                    contactName = p.justify_reason_display || p.notes || 'Ajuste Manual'
                }
                return { ...p, contact_name: contactName }
            }) : []
            return {
                results: payments,
                count: (paymentsData as any).count || payments.length
            }
        },
        staleTime: 2 * 60 * 1000,
        enabled: !!treasuryAccountId
    })
}

export function useLineSuggestionsQuery(lineId: number, enabled: boolean) {
    return useQuery({
        queryKey: reconciliationKeys.lineSuggestions(lineId),
        queryFn: () => financeApi.getLineSuggestions(lineId),
        staleTime: 2 * 60 * 1000,
        enabled: enabled && !!lineId
    })
}

export function usePaymentSuggestionsQuery(paymentId: number, enabled: boolean) {
    return useQuery({
        queryKey: reconciliationKeys.paymentSuggestions(paymentId),
        queryFn: () => financeApi.getPaymentSuggestions(paymentId),
        staleTime: 2 * 60 * 1000,
        enabled: enabled && !!paymentId
    })
}

export function useReconciledLinesQuery(statementId: number, params: QueryPaginationParams = {}) {
    return useQuery({
        queryKey: reconciliationKeys.reconciledLines(statementId, params),
        queryFn: async ({ signal }) => {
            const data = await financeApi.getStatementLines({
                statement: statementId,
                reconciliation_state: 'RECONCILED',
                page: params.page || 1,
                page_size: params.pageSize || 50,
                search: params.search,
                date_from: params.date_from,
                date_to: params.date_to,
                amount_min: params.amount_min,
                amount_max: params.amount_max,
                direction: params.type,
            })
            return data as PaginatedResponse<BankStatementLine>
        },
        staleTime: 2 * 60 * 1000,
        enabled: !!statementId
    })
}
