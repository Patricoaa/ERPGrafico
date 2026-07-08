import api from '@/lib/api'
import type { TreasuryMovement } from '../types'
import type {
    CreditCardStatement, CreditCardStatementCreatePayload,
    PayStatementPayload, ApplyChargesPayload,
    StatementChargesResponse,
} from './types'

export const cardStatementsApi = {
    list: async (params?: Record<string, string>): Promise<CreditCardStatement[]> => {
        const { data } = await api.get<{ results: CreditCardStatement[] }>('/treasury/card-statements/', { params })
        return data.results
    },

    get: async (id: number): Promise<CreditCardStatement> => {
        const { data } = await api.get<CreditCardStatement>(`/treasury/card-statements/${id}/`)
        return data
    },

    create: async (payload: CreditCardStatementCreatePayload): Promise<CreditCardStatement> => {
        const { data } = await api.post<CreditCardStatement>('/treasury/card-statements/', payload)
        return data
    },

    update: async (id: number, payload: Partial<CreditCardStatementCreatePayload>): Promise<CreditCardStatement> => {
        const { data } = await api.patch<CreditCardStatement>(`/treasury/card-statements/${id}/`, payload)
        return data
    },

    pay: async (id: number, payload: PayStatementPayload): Promise<CreditCardStatement> => {
        const { data } = await api.post<CreditCardStatement>(`/treasury/card-statements/${id}/pay/`, payload)
        return data
    },

    applyCharges: async (id: number, payload: ApplyChargesPayload): Promise<CreditCardStatement> => {
        const { data } = await api.post<CreditCardStatement>(`/treasury/card-statements/${id}/apply-charges/`, payload)
        return data
    },

    cancel: async (id: number, notes?: string): Promise<CreditCardStatement> => {
        const { data } = await api.post<CreditCardStatement>(`/treasury/card-statements/${id}/cancel/`, { notes: notes || '' })
        return data
    },

    getCharges: async (id: number): Promise<StatementChargesResponse> => {
        const { data } = await api.get<StatementChargesResponse>(`/treasury/card-statements/${id}/charges/`)
        return data
    },
}
