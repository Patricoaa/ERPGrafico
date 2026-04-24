import api from '@/lib/api'
import type { Account, AccountFilters, AccountPayload, FiscalYear, LedgerData } from '../types'

export const accountingApi = {
    getAccounts: async (filters?: AccountFilters): Promise<Account[]> => {
        const params = new URLSearchParams()
        if (filters?.code) params.append('code', filters.code)
        if (filters?.name) params.append('name', filters.name)
        if (filters?.account_type) params.append('account_type', filters.account_type)
        if (filters?.is_leaf) params.append('is_leaf', 'true')

        const { data } = await api.get<{ results: Account[] }>('/accounting/accounts/', { params })
        return data.results || data
    },

    getLedger: async (accountId: number, startDate: string, endDate: string): Promise<LedgerData> => {
        const { data } = await api.get<LedgerData>(
            `/accounting/accounts/${accountId}/ledger/?start_date=${startDate}&end_date=${endDate}`
        )
        return data
    },

    createEntry: async (payload: Record<string, unknown>): Promise<unknown> => {
        const { data } = await api.post('/accounting/entries/', payload)
        return data
    },

    updateEntry: async (id: number, payload: Record<string, unknown>): Promise<unknown> => {
        const { data } = await api.put(`/accounting/entries/${id}/`, payload)
        return data
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

    getSettings: async () => {
        const response = await api.get('/accounting/settings/current/')
        return response.data
    },

    updateSettings: async (data: Record<string, unknown>) => {
        const response = await api.patch('/accounting/settings/current/', data)
        return response.data
    },

    getFiscalYears: async (params?: Record<string, unknown>): Promise<FiscalYear[]> => {
        const { data } = await api.get<{ results: FiscalYear[] }>('/accounting/fiscal-years/', { params })
        return data.results || (data as unknown as FiscalYear[])
    },

    updateAccountMappings: async (updates: Array<{ id: number; field: string; value: string | null }>): Promise<void> => {
        await Promise.all(
            updates.map(({ id, field, value }) =>
                api.patch(`/accounting/accounts/${id}/`, { [field]: value })
            )
        )
    }
}
