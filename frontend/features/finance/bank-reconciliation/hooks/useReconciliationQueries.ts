import { useQuery } from '@tanstack/react-query'
import { financeApi } from '../../api/financeApi'
import type { BankStatement, TreasuryAccount, PaginatedResponse, BankStatementLine, ReconciliationSystemItem, QueryPaginationParams } from '../types'
import { reconciliationKeys } from './queryKeys'

interface SimulationResult {
    line: {
        description: string;
        date: string;
        amount: number | string;
    };
    payment: {
        partner?: string;
        reference?: string;
        amount: number | string;
    };
    score: number;
}

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

export function useSimulationQuery(rule: Record<string, unknown> | null) {
    return useQuery({
        queryKey: reconciliationKeys.simulation(rule ?? {}),
        queryFn: async () => {
            const treasuryAccount = rule?.treasury_account as Record<string, unknown> | undefined
            const payload = {
                ...rule,
                treasury_account_id: treasuryAccount?.id
            }
            const response = await financeApi.simulateRule(payload) as Record<string, unknown>
            return (response.results as SimulationResult[]) || []
        },
        staleTime: 30_000,
        enabled: !!rule,
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
            const rawResults = paymentsData.results
            const payments = rawResults.map((p) => {
                let contactName = (p.partner_name as string) || 'Particular'
                if (p.movement_type === 'TRANSFER') {
                    contactName = p.is_inbound ? ((p.from_account_name as string) || 'Cuenta Origen') : ((p.to_account_name as string) || 'Cuenta Destino')
                } else if (p.movement_type === 'ADJUSTMENT') {
                    contactName = (p.justify_reason_display as string) || (p.notes as string) || 'Ajuste Manual'
                }
                return { ...p, contact_name: contactName }
            }) as ReconciliationSystemItem[]
            return {
                results: payments,
                count: paymentsData.count || payments.length
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
