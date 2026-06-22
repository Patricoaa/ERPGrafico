import api from '@/lib/api'
import type { CreditLine, CreditLineCreatePayload } from './types'

export const creditLinesApi = {
    list: async (params?: { treasury_account_id?: number; bank_id?: number; status?: string }): Promise<CreditLine[]> => {
        const { data } = await api.get<CreditLine[]>('/treasury/credit-lines/', { params })
        return data
    },

    get: async (id: number): Promise<CreditLine> => {
        const { data } = await api.get<CreditLine>(`/treasury/credit-lines/${id}/`)
        return data
    },

    create: async (payload: CreditLineCreatePayload): Promise<CreditLine> => {
        const { data } = await api.post<CreditLine>('/treasury/credit-lines/', payload)
        return data
    },

    update: async (id: number, payload: Partial<CreditLineCreatePayload>): Promise<CreditLine> => {
        const { data } = await api.patch<CreditLine>(`/treasury/credit-lines/${id}/`, payload)
        return data
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/treasury/credit-lines/${id}/`)
    },

    overview: async (id: number): Promise<{ credit_line: CreditLine; movements: any[] }> => {
        const { data } = await api.get<{ credit_line: CreditLine; movements: any[] }>(`/treasury/credit-lines/${id}/overview/`)
        return data
    },
}
