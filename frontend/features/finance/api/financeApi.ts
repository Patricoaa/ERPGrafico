import api, { pollTask } from '@/lib/api'
import { toPage, type Page } from '@/lib/pagination'
import { type PaymentSuggestion, type LineSuggestion, type ReconciliationSettings } from '../bank-reconciliation/types'

export interface Budget {
    id: number
    name: string
    start_date: string
    end_date: string
    description?: string
}

export interface StatementParams {
    start_date?: string
    end_date?: string
    comp_start_date?: string
    comp_end_date?: string
    showComparison?: boolean
    fiscal_year_id?: number
}

async function fetchStatement(endpoint: string, params: StatementParams) {
    const queryParams: Record<string, unknown> = {
        start_date: params.start_date,
        end_date: params.end_date,
        is_async: true,
    }
    if (params.showComparison && params.comp_start_date && params.comp_end_date) {
        queryParams.comp_start_date = params.comp_start_date
        queryParams.comp_end_date = params.comp_end_date
    }
    if (params.fiscal_year_id) {
        queryParams.fiscal_year_id = params.fiscal_year_id
    }
    const res = await api.get<{ task_id?: string }>(endpoint, { params: queryParams })
    return res.data.task_id ? pollTask(res.data.task_id) : res.data
}

export const financeApi = {
    // ── Budgets ──
    getBudgets: async (): Promise<Page<Budget>> => {
        const { data } = await api.get<unknown>('/accounting/budgets/')
        return toPage<Budget>(data, 1, 50)
    },
    createBudget: (payload: Record<string, unknown>) =>
        api.post<unknown>('/accounting/budgets/', payload).then(r => r.data),
    updateBudget: (id: number, payload: Record<string, unknown>) =>
        api.patch<unknown>(`/accounting/budgets/${id}/`, payload).then(r => r.data),
    getBudgetVariance: (id: number, params?: Record<string, unknown>) =>
        api.get<unknown>(`/accounting/budgets/${id}/variance/`, { params }).then(r => r.data),
    getBudgetableAccounts: () =>
        api.get<unknown>('/accounting/accounts/budgetable/').then(r => r.data),
    getBudgetExecution: (id: number) =>
        api.get<unknown>(`/accounting/budgets/${id}/execution/`).then(r => r.data),
    getBudgetDetail: (id: number) =>
        api.get<unknown>(`/accounting/budgets/${id}/`).then(r => r.data),
    getBudgetPreviousYearActuals: (id: number) =>
        api.get<unknown>(`/accounting/budgets/${id}/previous_year_actuals/`).then(r => r.data),
    setBudgetItems: (id: number, items: unknown) =>
        api.post<unknown>(`/accounting/budgets/${id}/set_items/`, { items }).then(r => r.data),
    exportBudgetCsv: (id: number) =>
        api.get<unknown>(`/accounting/budgets/${id}/export_csv/`, { responseType: 'blob' }).then(r => r.data),

    // ── Accounts ──
    getAccount: (id: number) =>
        api.get<unknown>(`/accounting/accounts/${id}/`).then(r => r.data),

    // ── Payments ──
    getPayments: async (params?: Record<string, unknown>): Promise<{ results: Record<string, unknown>[]; count: number }> => {
        const { data } = await api.get<{ results: Record<string, unknown>[]; count: number }>('/treasury/payments/', { params })
        return data
    },
    registerPayment: (payload: Record<string, unknown>, idempotencyKey?: string) =>
        api.post<unknown>('/treasury/payments/register_movement/', payload, {
            headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
        }).then(r => r.data),
    updatePayment: (id: number, payload: Record<string, unknown>) =>
        api.patch<unknown>(`/treasury/payments/${id}/`, payload).then(r => r.data),
    getPaymentMethods: (params?: Record<string, unknown>) =>
        api.get<unknown>('/treasury/payment-methods/', { params }).then(r => r.data),
    getAllocate: (paymentId: number, payload: Record<string, unknown>) =>
        api.post<unknown>(`/treasury/payments/${paymentId}/allocate/`, payload).then(r => r.data),

    // ── Invoices (billing) ──
    getPendingInvoices: async (params?: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
        const { data } = await api.get<{ results: Record<string, unknown>[] }>('/billing/invoices/', { params })
        return data.results
    },
    getBillingInvoices: async (params?: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
        const { data } = await api.get<{ results: Record<string, unknown>[] }>('/billing/invoices/', { params })
        return data.results
    },

    // ── BI Analytics ──
    getBIAnalytics: (params?: Record<string, unknown>) =>
        api.get<{ task_id?: string } & Record<string, unknown>>('finances/api/bi-analytics/', { params }).then(r => {
            const d = r.data
            return d.task_id ? pollTask(d.task_id) : d
        }),

    // ── Ratios / Analysis ──
    getAnalysis: (params?: Record<string, unknown>) =>
        api.get<{ task_id?: string } & Record<string, unknown>>('finances/api/analysis/', { params }).then(r => {
            const d = r.data
            return d.task_id ? pollTask(d.task_id) : d
        }),

    // ── Financial Statements ──
    getBalanceSheet: (params: StatementParams) =>
        fetchStatement('finances/api/balance-sheet/', params),
    getIncomeStatement: (params: StatementParams) =>
        fetchStatement('finances/api/income-statement/', params),
    getCashFlow: (params: StatementParams) =>
        fetchStatement('finances/api/cash-flow/', params),

    // ── Bank Reconciliation: Statements ──
    getStatements: async (params?: Record<string, string>) => {
        const { data } = await api.get<{ results: Record<string, unknown>[] }>('/treasury/statements/', { params })
        return data.results
    },
    getStatement: (id: number) =>
        api.get<unknown>(`/treasury/statements/${id}/`).then(r => r.data),
    getStatementFormats: () =>
        api.get<unknown>('/treasury/statements/formats/').then(r => r.data),
    previewStatement: (formData: FormData) =>
        api.post<unknown>('/treasury/statements/preview/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(r => r.data),
    dryRunStatement: (formData: FormData) =>
        api.post<unknown>('/treasury/statements/dry_run/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(r => r.data),
    importStatement: (formData: FormData) =>
        api.post<unknown>('/treasury/statements/import_statement/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        }).then(r => r.data),
    autoMatch: (statementId: number, payload?: Record<string, unknown>) =>
        api.post<unknown>(`/treasury/statements/${statementId}/auto_match/`, payload).then(r => r.data),
    getAutoMatchStatus: (statementId: number, params?: Record<string, unknown>) =>
        api.get<unknown>(`/treasury/statements/${statementId}/auto_match_status/`, { params }).then(r => r.data),

    // ── Bank Reconciliation: Accounts ──
    getReconciliationAccounts: () =>
        api.get<unknown>('/treasury/accounts/').then(r => r.data),

    // ── Bank Reconciliation: Settings ──
    getReconciliationSettings: (accountId?: number | string) =>
        api.get<ReconciliationSettings>('/treasury/reconciliation-settings/for_account/', {
            params: { treasury_account_id: accountId },
        }).then(r => r.data),
    updateReconciliationSettings: (id: number, payload: Record<string, unknown>) =>
        api.patch<ReconciliationSettings>(`/treasury/reconciliation-settings/${id}/`, payload).then(r => r.data),


    // ── Bank Reconciliation: Statement Lines ──
    getStatementLines: (params?: Record<string, unknown>) =>
        api.get<unknown>('/treasury/statement-lines/', { params }).then(r => r.data),
    getLineSuggestions: (lineId: number) =>
        api.get<{ suggestions?: PaymentSuggestion[] }>(`/treasury/statement-lines/${lineId}/suggestions/`).then(r => r.data.suggestions ?? []),
    getSuggestedDifference: (lineId: number) =>
        api.get<unknown>(`/treasury/statement-lines/${lineId}/suggested_difference/`).then(r => r.data),

    // ── Bank Reconciliation: Payments (system items) ──
    getPaymentSuggestions: (paymentId: number) =>
        api.get<{ suggestions?: LineSuggestion[] }>(`/treasury/payments/${paymentId}/suggestions/`).then(r => r.data.suggestions ?? []),

    // ── Bank Reconciliation: Matches ──
    matchStatementLine: (lineId: number, payload: Record<string, unknown>) =>
        api.post<unknown>(`/treasury/statement-lines/${lineId}/match/`, payload).then(r => r.data),
    confirmMatch: (lineId: number, payload: Record<string, unknown>) =>
        api.post<unknown>(`/treasury/statement-lines/${lineId}/confirm/`, payload).then(r => r.data),
    groupMatchLines: (payload: Record<string, unknown>) =>
        api.post<unknown>('/treasury/statement-lines/match_group/', payload).then(r => r.data),
    unmatchLine: (lineId: number) =>
        api.post<unknown>(`/treasury/statement-lines/${lineId}/unmatch/`).then(r => r.data),
    updateStatementLine: (lineId: number, payload: Record<string, unknown>) =>
        api.patch<unknown>(`/treasury/statement-lines/${lineId}/`, payload).then(r => r.data),
    bulkExcludeLines: (payload: Record<string, unknown>) =>
        api.post<unknown>('/treasury/statement-lines/bulk_exclude/', payload).then(r => r.data),
    allocateMovement: (movementId: number, payload: Record<string, unknown>) =>
        api.post<unknown>(`/treasury/movements/${movementId}/allocate/`, payload).then(r => r.data),
    createMovement: (payload: Record<string, unknown>) =>
        api.post<unknown>('/treasury/movements/', payload).then(r => r.data),

    // ── Bank Reconciliation: Journals ──
    createJournal: (payload: Record<string, unknown>) =>
        api.post<unknown>('/treasury/journals/', payload).then(r => r.data),
    updateJournal: (id: number, payload: Record<string, unknown>) =>
        api.put<unknown>(`/treasury/journals/${id}/`, payload).then(r => r.data),

    // ── Bank Reconciliation: Rules Simulation ──
    simulateRule: (payload: Record<string, unknown>) =>
        api.post<unknown>('/treasury/reconciliation-rules/simulate/', payload).then(r => r.data),
}
