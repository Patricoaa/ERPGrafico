import api from '@/lib/api'
import type { Check, CheckCreatePayload, CheckDepositPayload, CheckPortfolioSummary } from './types'

export const checksApi = {
    list: async (params?: Record<string, string>): Promise<Check[]> => {
        const { data } = await api.get<Check[]>('/treasury/checks/', { params })
        return data
    },

    get: async (id: number): Promise<Check> => {
        const { data } = await api.get<Check>(`/treasury/checks/${id}/`)
        return data
    },

    create: async (payload: CheckCreatePayload): Promise<Check> => {
        const { data } = await api.post<Check>('/treasury/checks/', payload)
        return data
    },

    deposit: async (id: number, payload: CheckDepositPayload): Promise<Check> => {
        const { data } = await api.post<Check>(`/treasury/checks/${id}/deposit/`, payload)
        return data
    },

    clear: async (id: number): Promise<Check> => {
        const { data } = await api.post<Check>(`/treasury/checks/${id}/clear/`, {})
        return data
    },

    bounce: async (id: number, notes?: string): Promise<Check> => {
        const { data } = await api.post<Check>(`/treasury/checks/${id}/bounce/`, { notes })
        return data
    },

    void: async (id: number, notes?: string): Promise<Check> => {
        const { data } = await api.post<Check>(`/treasury/checks/${id}/void/`, { notes })
        return data
    },

    markCashed: async (id: number): Promise<Check> => {
        const { data } = await api.post<Check>(`/treasury/checks/${id}/clear/`, {})
        return data
    },

    endorse: async (id: number, endorsedTo: number): Promise<Check> => {
        const { data } = await api.post<Check>(`/treasury/checks/${id}/endorse/`, { endorsed_to: endorsedTo })
        return data
    },

    portfolio: async (params?: Record<string, string>): Promise<CheckPortfolioSummary> => {
        const { data } = await api.get<CheckPortfolioSummary>('/treasury/checks/portfolio/', { params })
        return data
    },

    inTransit: async (params?: Record<string, string>): Promise<CheckPortfolioSummary> => {
        const { data } = await api.get<CheckPortfolioSummary>('/treasury/checks/in_transit/', { params })
        return data
    },
}
