import api from "@/lib/api"
import { PartnerSummary, PartnerStatement, PartnerTransactionPayload } from "../types/partner"

export const partnersApi = {
    /**
     * Get summary metrics for all partners
     */
    getSummary: async (): Promise<PartnerSummary> => {
        const response = await api.get('/contacts/partners_summary/')
        return response.data
    },

    /**
     * Get all contacts marked as partners
     */
    getPartners: async () => {
        const response = await api.get('/contacts/partners/')
        return response.data
    },

    /**
     * Get statement (transactions and balance) for a specific partner
     */
    getStatement: async (contactId: number): Promise<PartnerStatement> => {
        const response = await api.get(`/contacts/${contactId}/partner_statement/`)
        return response.data
    },

    /**
     * Register a new transaction (contribution/withdrawal) for a partner
     */
    createTransaction: async (contactId: number, data: PartnerTransactionPayload) => {
        const response = await api.post(`/contacts/${contactId}/partner_transactions/`, data)
        return response.data
    },

    /**
     * Setup or edit partner properties for a given contact
     */
    setupPartner: async (contactId: number, data: { is_partner: boolean, partner_equity_percentage?: string | number, partner_account_id?: number | null }) => {
        const response = await api.post(`/contacts/${contactId}/setup_partner/`, data)
        return response.data
    },

    /**
     * Bulk setup partners and initial capital entry
     */
    initialSetup: async (partners: { contact_id: number, amount: number }[]) => {
        const response = await api.post('/contacts/initial_setup/', { partners })
        return response.data
    },

    /**
     * Record a formal capital subscription or reduction
     */
    recordSubscription: async (data: { contact_id: number, amount: number, type: 'SUBSCRIPTION' | 'REDUCTION', date?: string, description?: string }) => {
        const response = await api.post('/contacts/equity_subscription/', data)
        return response.data
    },

    /**
     * Record a transfer of equity between two partners
     */
    recordTransfer: async (data: { from_contact_id: number, to_contact_id: number, amount: number, date?: string, description?: string }) => {
        const response = await api.post('/contacts/equity_transfer/', data)
        return response.data
    },

    /**
     * Get all partner transactions (global ledger)
     */
    getTransactions: async () => {
        const response = await api.get('/contacts/all_partner_transactions/')
        return response.data
    }
}
