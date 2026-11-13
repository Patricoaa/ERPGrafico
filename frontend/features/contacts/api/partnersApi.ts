import api from "@/lib/api"
import { type Partner, type PartnerEquityStake, type PartnerSummary, type PartnerStatement, type PartnerOverview, type PartnerTransactionPayload, type ProfitDistribution, type ProfitDistributionImpact, type PartnerEvolutionPeriod } from "../types/partner"

export const partnersApi = {
    /**
     * Get summary metrics for all partners
     */
    getSummary: async (): Promise<PartnerSummary> => {
        const response = await api.get<PartnerSummary>('/contacts/partners_summary/')
        // eslint-disable-next-line pagination/no-raw-response-data
        return response.data
    },

    /**
     * Get all contacts marked as partners
     */
    getPartners: async (): Promise<Partner[]> => {
        const response = await api.get<Partner[]>('/contacts/partners/')
        // eslint-disable-next-line pagination/no-raw-response-data
        return response.data
    },

    /**
     * Get statement (transactions and balance) for a specific partner
     */
    getStatement: async (contactId: number): Promise<PartnerStatement> => {
        const response = await api.get<PartnerStatement>(`/contacts/${contactId}/partner_statement/`)
        return response.data
    },

    /**
     * Resumen de la ficha de un socio (alertas, KPIs, datos y composición)
     */
    getOverview: async (contactId: number): Promise<PartnerOverview> => {
        const response = await api.get<PartnerOverview>(`/contacts/${contactId}/partner_overview/`)
        return response.data
    },

    /**
     * Register a new transaction (contribution/withdrawal) for a partner
     */
    createTransaction: async (contactId: number, data: PartnerTransactionPayload, idempotencyKey: string) => {
        const response = await api.post(`/contacts/${contactId}/partner_transactions/`, data, { headers: { 'Idempotency-Key': idempotencyKey } })
        return response.data
    },

    /**
     * Dar de baja a un socio (vuelve a contacto normal). El backend valida saldos y capital.
     */
    demotePartner: async (contactId: number) => {
        const response = await api.post<unknown>(`/contacts/${contactId}/demote-partner/`)
        return response.data
    },

    /**
     * Historial de participación (vigencias del %) de un socio
     */
    getEquityStakesHistory: async (partnerId: number): Promise<PartnerEquityStake[]> => {
        const response = await api.get<PartnerEquityStake[]>(`/contacts/equity_stakes_history/?partner_id=${partnerId}`)
        // eslint-disable-next-line pagination/no-raw-response-data
        return response.data
    },

    /**
     * Record a formal capital subscription or reduction
     */
    recordSubscription: async (data: { contact_id: number, amount: number, type: 'SUBSCRIPTION' | 'REDUCTION', date?: string, description?: string }, idempotencyKey: string) => {
        const response = await api.post('/contacts/equity_subscription/', data, { headers: { 'Idempotency-Key': idempotencyKey } })
        return response.data
    },

    /**
     * Record a transfer of equity between two partners
     */
    recordTransfer: async (data: { from_contact_id: number, to_contact_id: number, amount: number, date?: string, description?: string }, idempotencyKey: string) => {
        const response = await api.post('/contacts/equity_transfer/', data, { headers: { 'Idempotency-Key': idempotencyKey } })
        return response.data
    },

    recordDividendPayment: async (contactId: number, data: { amount: number, date: string, treasury_account_id?: number, description?: string }, idempotencyKey: string) => {
        const response = await api.post(`/contacts/${contactId}/individual_dividend_payment/`, data, { headers: { 'Idempotency-Key': idempotencyKey } })
        return response.data
    },

    /**
     * Profit Distributions
     */
    getProfitDistributions: async (year?: number): Promise<ProfitDistribution[]> => {
        const url = year ? `/contacts/profit-distributions/?fiscal_year=${year}` : '/contacts/profit-distributions/'
        const response = await api.get<{ results: ProfitDistribution[] }>(url)
        return response.data.results
    },

    getProfitDistribution: async (id: number): Promise<ProfitDistribution> => {
        const response = await api.get<ProfitDistribution>(`/contacts/profit-distributions/${id}/`)
        return response.data
    },

    getProfitDistributionImpact: async (id: number): Promise<ProfitDistributionImpact> => {
        const response = await api.get<ProfitDistributionImpact>(`/contacts/profit-distributions/${id}/impact_preview/`)
        return response.data
    },

    /** PDF del estado de resultados del ejercicio, desde la copia congelada al cierre. */
    getProfitDistributionResultPdf: async (id: number): Promise<Blob> => {
        const response = await api.get<Blob>(`/contacts/profit-distributions/${id}/result_pdf/`, { responseType: 'blob' })
        return response.data
    },

    createProfitDistribution: async (data: { fiscal_year_id: number, net_result: number, resolution_date: string, acta_number?: string, notes?: string }): Promise<ProfitDistribution> => {
        const response = await api.post<ProfitDistribution>('/contacts/profit-distributions/', data)
        return response.data
    },

    updateProfitDistribution: async (id: number, data: Record<string, unknown>) => {
        const response = await api.patch(`/contacts/profit-distributions/${id}/`, data)
        return response.data
    },

    updateProfitDistributionLines: async (id: number, lines: { line_id: number, destinations: { destination: string, amount: number }[] }[]) => {
        const response = await api.patch(`/contacts/profit-distributions/${id}/update_destinations/`, { lines })
        return response.data
    },

    approveProfitDistribution: async (id: number, idempotencyKey: string) => {
        const response = await api.post(`/contacts/profit-distributions/${id}/approve/`, undefined, { headers: { 'Idempotency-Key': idempotencyKey } })
        return response.data
    },

    executeProfitDistribution: async (id: number, idempotencyKey: string) => {
        const response = await api.post(`/contacts/profit-distributions/${id}/execute/`, undefined, { headers: { 'Idempotency-Key': idempotencyKey } })
        return response.data
    },

    recalculateProfitDistribution: async (id: number) => {
        const response = await api.post<ProfitDistribution>(`/contacts/profit-distributions/${id}/recalculate/`)
        return response.data
    },

    deleteProfitDistribution: async (id: number) => {
        const response = await api.delete(`/contacts/profit-distributions/${id}/`)
        return response.data
    },

    massPaymentProfitDistribution: async (
        id: number,
        treasuryAccountId: number,
        paymentsData: { partner_id: number, amount: number }[],
        idempotencyKey: string,
    ) => {
        const response = await api.post(
            `/contacts/profit-distributions/${id}/mass_payment/`,
            { treasury_account_id: treasuryAccountId, payments_data: paymentsData },
            { headers: { 'Idempotency-Key': idempotencyKey } },
        )
        return response.data
    },

    massMobilizeRetainedEarnings: async (payload: { mobilizations: { partner_id: number, dividend_amount: number, reinvest_amount: number }[], date: string, description: string }, idempotencyKey: string) => {
        const response = await api.post(`/contacts/mass_mobilize_retained_earnings/`, payload, { headers: { 'Idempotency-Key': idempotencyKey } })
        return response.data
    },

    getPartnerEvolution: async (months = 24, granularity = 'month'): Promise<{ periods: PartnerEvolutionPeriod[] }> => {
        const response = await api.get<{ periods: PartnerEvolutionPeriod[] }>(`/contacts/partner_evolution/?months=${months}&granularity=${granularity}`)
        // eslint-disable-next-line pagination/no-raw-response-data
        return response.data
    },
}
