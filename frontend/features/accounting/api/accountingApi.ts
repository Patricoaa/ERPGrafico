import api from '@/lib/api'
import type { Account, AccountFilters, AccountPayload, AccountingPeriod, FiscalYear, LedgerData } from '../types'
import { toPage, type Page } from '@/lib/pagination'
import { fetchBoundedList } from '@/lib/bounded-list'
import { z } from 'zod'

/** Documento pendiente del checklist de cierre (espejo de `AccountingPeriodService.get_period_status`). */
const pendingDocumentSchema = z.object({
    id: z.number(),
    label: z.string(),
    amount: z.string().nullable(),
    date: z.string().nullable(),
})

/**
 * Respuesta de `GET /tax/accounting-periods/{id}/status_check/`. Las listas traen hasta 50 documentos;
 * el total real está en el `*_count` de cada categoría.
 */
export const accountingPeriodStatusSchema = z.object({
    tax_period_id: z.number().nullable(),
    draft_entries: z.array(pendingDocumentSchema),
    draft_invoices: z.array(pendingDocumentSchema),
    unposted_payrolls: z.array(pendingDocumentSchema),
    unconfirmed_statements: z.array(pendingDocumentSchema),
    period_exists: z.boolean(),
    period_status: z.string(),
    tax_period_closed: z.boolean(),
    draft_entries_count: z.number(),
    draft_invoices_count: z.number(),
    payroll_count: z.number(),
    payroll_posted_count: z.number(),
    reconciliation_count: z.number(),
    reconciliation_confirmed_count: z.number(),
    is_fully_closable: z.boolean(),
})

export type PendingDocument = z.infer<typeof pendingDocumentSchema>
export type AccountingPeriodStatus = z.infer<typeof accountingPeriodStatusSchema>

export const accountingApi = {
    getAccounts: async (filters?: AccountFilters): Promise<Account[]> =>
        fetchBoundedList<Account>('/accounting/accounts/', {
            code: filters?.code || undefined,
            name: filters?.name || undefined,
            account_type: filters?.account_type || undefined,
            is_leaf: filters?.is_leaf ? 'true' : undefined,
            search: filters?.search || undefined,
        }),

    getLedger: async (accountId: number, startDate: string, endDate: string): Promise<LedgerData> => {
        const { data } = await api.get<LedgerData>(
            `/accounting/accounts/${accountId}/ledger/?start_date=${startDate}&end_date=${endDate}`
        )
        return data
    },

    getEntries: async (params?: Record<string, unknown>): Promise<Page<unknown>> => {
        const { data } = await api.get<unknown>('/accounting/entries/', { params })
        return toPage(data, (params?.page as number) ?? 1, (params?.page_size as number) ?? 50)
    },
    getEntry: async (id: number | string) => {
        const { data } = await api.get<unknown>(`/accounting/entries/${id}/`)
        return data
    },

    createEntry: async (payload: Record<string, unknown>): Promise<unknown> => {
        const { data } = await api.post<unknown>('/accounting/entries/', payload)
        return data
    },

    updateEntry: async (id: number, payload: Record<string, unknown>): Promise<unknown> => {
        const { data } = await api.patch<unknown>(`/accounting/entries/${id}/`, payload)
        return data
    },

    postEntry: async (id: number): Promise<void> => {
        await api.post(`/accounting/entries/${id}/post_entry/`)
    },
    reverseEntry: async (id: number): Promise<void> => {
        await api.post(`/accounting/entries/${id}/reverse_entry/`)
    },
    deleteEntry: async (id: number): Promise<void> => {
        await api.delete(`/accounting/entries/${id}/`)
    },

    getAccount: async (id: number): Promise<Account> => {
        const { data } = await api.get<Account>(`/accounting/accounts/${id}/`)
        return data
    },

    createAccount: async (payload: AccountPayload): Promise<Account> => {
        const { data } = await api.post<Account>('/accounting/accounts/', payload)
        return data
    },

    updateAccount: async (id: number, payload: Partial<AccountPayload>): Promise<Account> => {
        const { data } = await api.patch<Account>(`/accounting/accounts/${id}/`, payload)
        return data
    },

    deleteAccount: async (id: number): Promise<void> => {
        await api.delete(`/accounting/accounts/${id}/`)
    },

    /** Archivo pattern: soft-delete via `is_active=false` (hard DELETE is blocked server-side with 405). */
    archiveAccount: async (id: number, is_active: boolean): Promise<Account> => {
        const { data } = await api.patch<Account>(`/accounting/accounts/${id}/`, { is_active })
        return data
    },

    getSettings: async () => {
        const response = await api.get<Record<string, unknown>>('/accounting/settings/current/')
        return response.data
    },

    updateSettings: async (data: Record<string, unknown>) => {
        const response = await api.patch<Record<string, unknown>>('/accounting/settings/current/', data)
        return response.data
    },

    getAccountingPeriods: async (params?: Record<string, unknown>): Promise<AccountingPeriod[]> => {
        const { data } = await api.get<AccountingPeriod[]>('/tax/accounting-periods/', { params })
        return data
    },

    getFiscalYears: async (params?: Record<string, unknown>): Promise<FiscalYear[]> => {
        const { data } = await api.get<FiscalYear[]>('/accounting/fiscal-years/', { params })
        return data
    },

    updateAccountMappings: async (updates: Array<{ id: number; field: string; value: string | null }>): Promise<void> => {
        await Promise.all(
            updates.map(({ id, field, value }) =>
                api.patch(`/accounting/accounts/${id}/`, { [field]: value })
            )
        )
    },

    getAccountingPeriodStatus: async (periodId: number): Promise<AccountingPeriodStatus> => {
        const { data } = await api.get<unknown>(`/tax/accounting-periods/${periodId}/status_check/`)
        return accountingPeriodStatusSchema.parse(data)
    },

    checkPeriodClosed: async (date: string): Promise<{ is_closed: boolean; date: string; period_name?: string }> => {
        const { data } = await api.get<{ is_closed: boolean; date: string; period_name?: string }>(`tax/accounting-periods/check_closed/?date=${date}`)
        return data
    },
}
