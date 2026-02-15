import api from '@/lib/api'
import type { Account, AccountFilters, AccountPayload } from '../types'

export const accountingApi = {
    getAccounts: async (filters?: AccountFilters): Promise<Account[]> => {
        const params = new URLSearchParams()
        if (filters?.code) params.append('code', filters.code)
        if (filters?.name) params.append('name', filters.name)
        if (filters?.account_type) params.append('account_type', filters.account_type)

        const { data } = await api.get<{ results: Account[] }>('/accounting/accounts/', { params })
        return data.results || data
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
    }
}
