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

    getTransactions: async () => {
        const response = await api.get('/contacts/all_partner_transactions/')
        return response.data
    },

    /**
     * Profit Distributions
     */
    getProfitDistributions: async (year?: number) => {
        const url = year ? `/contacts/profit-distributions/?fiscal_year=${year}` : '/contacts/profit-distributions/'
        const response = await api.get(url)
        return response.data
    },

    createProfitDistribution: async (data: { fiscal_year_id: number, net_result: number, resolution_date: string, acta_number?: string, notes?: string }) => {
        const response = await api.post('/contacts/profit-distributions/', data)
        return response.data
    },

    updateProfitDistribution: async (id: number, data: any) => {
        const response = await api.patch(`/contacts/profit-distributions/${id}/`, data)
        return response.data
    },

    updateProfitDistributionLines: async (id: number, lines: { line_id: number, destination: string }[]) => {
        const response = await api.patch(`/contacts/profit-distributions/${id}/update_destinations/`, { lines })
        return response.data
    },

    approveProfitDistribution: async (id: number) => {
        const response = await api.post(`/contacts/profit-distributions/${id}/approve/`)
        return response.data
    },

    executeProfitDistribution: async (id: number) => {
        const response = await api.post(`/contacts/profit-distributions/${id}/execute/`)
        return response.data
    },

    recalculateProfitDistribution: async (id: number) => {
        const response = await api.post(`/contacts/profit-distributions/${id}/recalculate/`)
        return response.data
    },

    deleteProfitDistribution: async (id: number) => {
        const response = await api.delete(`/contacts/profit-distributions/${id}/`)
        return response.data
    },

    massPaymentProfitDistribution: async (id: number, treasuryAccountId: number) => {
        const response = await api.post(`/contacts/profit-distributions/${id}/mass_payment/`, { treasury_account_id: treasuryAccountId })
        return response.data
    }
}
