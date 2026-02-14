import api from '@/lib/api'
import type {
    Terminal,
    TerminalCreatePayload,
    TerminalUpdatePayload,
    TreasuryAccount,
    TreasuryAccountCreatePayload,
    TreasuryAccountUpdatePayload,
    PaymentMethod
} from '../types'

/**
 * Centralized API service for treasury operations
 * Handles all HTTP requests related to POS terminals, treasury accounts, and payment methods
 */
export const treasuryApi = {
    // ========== Terminals ==========

    /**
     * Fetch all POS terminals
     */
    getTerminals: async (): Promise<Terminal[]> => {
        const { data } = await api.get<{ results: Terminal[] }>('/treasury/pos-terminals/')
        return data.results || data
    },

    /**
     * Create new terminal
     */
    createTerminal: async (payload: TerminalCreatePayload): Promise<Terminal> => {
        const { data } = await api.post<Terminal>('/treasury/pos-terminals/', payload)
        return data
    },

    /**
     * Update terminal (partial update)
     */
    updateTerminal: async (id: number, payload: TerminalUpdatePayload): Promise<Terminal> => {
        const { data } = await api.patch<Terminal>(`/treasury/pos-terminals/${id}/`, payload)
        return data
    },

    /**
     * Delete terminal
     */
    deleteTerminal: async (id: number): Promise<void> => {
        await api.delete(`/treasury/pos-terminals/${id}/`)
    },

    // ========== Treasury Accounts ==========

    /**
     * Fetch all treasury accounts
     */
    getAccounts: async (): Promise<TreasuryAccount[]> => {
        const { data } = await api.get<{ results: TreasuryAccount[] }>('/treasury/accounts/')
        return data.results || data
    },

    /**
     * Create new treasury account
     */
    createAccount: async (payload: TreasuryAccountCreatePayload): Promise<TreasuryAccount> => {
        const { data } = await api.post<TreasuryAccount>('/treasury/accounts/', payload)
        return data
    },

    /**
     * Update treasury account
     */
    updateAccount: async (id: number, payload: TreasuryAccountUpdatePayload): Promise<TreasuryAccount> => {
        const { data } = await api.patch<TreasuryAccount>(`/treasury/accounts/${id}/`, payload)
        return data
    },

    /**
     * Delete treasury account
     */
    deleteAccount: async (id: number): Promise<void> => {
        await api.delete(`/treasury/accounts/${id}/`)
    },

    // ========== Payment Methods ==========

    /**
     * Fetch all payment methods
     */
    getPaymentMethods: async (): Promise<PaymentMethod[]> => {
        const { data } = await api.get<{ results: PaymentMethod[] }>('/treasury/payment-methods/')
        return data.results || data
    },
}
