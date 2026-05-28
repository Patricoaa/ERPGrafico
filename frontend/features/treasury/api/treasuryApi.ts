import api from '@/lib/api'
import { toPage, type Page } from '@/lib/pagination'
import type {
    Terminal,
    TerminalCreatePayload,
    TerminalUpdatePayload,
    TreasuryAccount,
    TreasuryAccountCreatePayload,
    TreasuryAccountUpdatePayload,
    PaymentMethod,
    PaymentTerminalDevice,
    PaymentTerminalProvider,
    PaymentTerminalProviderCreatePayload,
    PaymentTerminalProviderUpdatePayload,
    PaymentTerminalDeviceCreatePayload,
    PaymentTerminalDeviceUpdatePayload,
    Bank,
    BankCreatePayload,
    BankUpdatePayload,
    PaymentMethodCreatePayload,
    PaymentMethodUpdatePayload,
    TransferPayload,
    MovementCreatePayload,
    TerminalBatchCreatePayload,
    MonthlyInvoicePayload,
    PaymentUpdatePayload,
    ContactBrief,
    PartnerCapitalInfo,
    TreasuryMovement,
} from '../types'

export const treasuryApi = {
    // ========== Terminals ==========

    getTerminals: async (): Promise<Terminal[]> => {
        const response = await api.get<Terminal[]>('/treasury/pos-terminals/')
        return response.data
    },

    createTerminal: async (payload: TerminalCreatePayload): Promise<Terminal> => {
        const { data } = await api.post<Terminal>('/treasury/pos-terminals/', payload)
        return data
    },

    updateTerminal: async (id: number, payload: TerminalUpdatePayload): Promise<Terminal> => {
        const { data } = await api.patch<Terminal>(`/treasury/pos-terminals/${id}/`, payload)
        return data
    },

    deleteTerminal: async (id: number): Promise<void> => {
        await api.delete(`/treasury/pos-terminals/${id}/`)
    },

    // ========== Terminal Providers ==========

    getTerminalProviders: async (): Promise<PaymentTerminalProvider[]> => {
        const response = await api.get<PaymentTerminalProvider[]>('/treasury/terminal-providers/')
        return response.data
    },

    createTerminalProvider: async (payload: PaymentTerminalProviderCreatePayload): Promise<PaymentTerminalProvider> => {
        const { data } = await api.post<PaymentTerminalProvider>('/treasury/terminal-providers/', payload)
        return data
    },

    updateTerminalProvider: async (id: number, payload: PaymentTerminalProviderUpdatePayload): Promise<PaymentTerminalProvider> => {
        const { data } = await api.patch<PaymentTerminalProvider>(`/treasury/terminal-providers/${id}/`, payload)
        return data
    },

    deleteTerminalProvider: async (id: number): Promise<void> => {
        await api.delete(`/treasury/terminal-providers/${id}/`)
    },

    // ========== Terminal Devices ==========

    getTerminalDevices: async (params?: Record<string, string>): Promise<PaymentTerminalDevice[]> => {
        const response = await api.get<PaymentTerminalDevice[]>('/treasury/terminal-devices/', { params })
        return response.data
    },

    getTerminalDevice: async (id: number): Promise<PaymentTerminalDevice> => {
        const { data } = await api.get<PaymentTerminalDevice>(`/treasury/terminal-devices/${id}/`)
        return data
    },

    createTerminalDevice: async (payload: PaymentTerminalDeviceCreatePayload): Promise<PaymentTerminalDevice> => {
        const { data } = await api.post<PaymentTerminalDevice>('/treasury/terminal-devices/', payload)
        return data
    },

    updateTerminalDevice: async (id: number, payload: PaymentTerminalDeviceUpdatePayload): Promise<PaymentTerminalDevice> => {
        const { data } = await api.patch<PaymentTerminalDevice>(`/treasury/terminal-devices/${id}/`, payload)
        return data
    },

    deleteTerminalDevice: async (id: number): Promise<void> => {
        await api.delete(`/treasury/terminal-devices/${id}/`)
    },

    // ========== Terminal Batches ==========

    getTerminalBatches: async (params?: Record<string, string>): Promise<any[]> => {
        const response = await api.get<any[]>('/treasury/terminal-batches/', { params })
        return response.data
    },

    createTerminalBatch: async (payload: TerminalBatchCreatePayload): Promise<any> => {
        const { data } = await api.post('/treasury/terminal-batches/', payload)
        return data
    },

    // ========== Treasury Accounts ==========

    getAccounts: async (filters?: { name?: string; account_type?: string }): Promise<TreasuryAccount[]> => {
        const { data } = await api.get<TreasuryAccount[]>('/treasury/accounts/', { params: filters })
        return data
    },

    getAccount: async (id: number): Promise<TreasuryAccount> => {
        const { data } = await api.get<TreasuryAccount>(`/treasury/accounts/${id}/`)
        return data
    },

    createAccount: async (payload: TreasuryAccountCreatePayload): Promise<TreasuryAccount> => {
        const { data } = await api.post<TreasuryAccount>('/treasury/accounts/', payload)
        return data
    },

    updateAccount: async (id: number, payload: TreasuryAccountUpdatePayload): Promise<TreasuryAccount> => {
        const { data } = await api.patch<TreasuryAccount>(`/treasury/accounts/${id}/`, payload)
        return data
    },

    deleteAccount: async (id: number): Promise<void> => {
        await api.delete(`/treasury/accounts/${id}/`)
    },

    // ========== Payment Methods ==========

    getPaymentMethods: async (): Promise<PaymentMethod[]> => {
        const { data } = await api.get<PaymentMethod[]>('/treasury/payment-methods/')
        return data
    },

    createPaymentMethod: async (payload: PaymentMethodCreatePayload): Promise<PaymentMethod> => {
        const { data } = await api.post<PaymentMethod>('/treasury/payment-methods/', payload)
        return data
    },

    updatePaymentMethod: async (id: number, payload: PaymentMethodUpdatePayload): Promise<PaymentMethod> => {
        const { data } = await api.patch<PaymentMethod>(`/treasury/payment-methods/${id}/`, payload)
        return data
    },

    deletePaymentMethod: async (id: number): Promise<void> => {
        await api.delete(`/treasury/payment-methods/${id}/`)
    },

    // ========== Banks ==========

    getBanks: async (): Promise<Bank[]> => {
        const { data } = await api.get<Bank[]>('/treasury/banks/')
        return data
    },

    createBank: async (payload: BankCreatePayload): Promise<Bank> => {
        const { data } = await api.post<Bank>('/treasury/banks/', payload)
        return data
    },

    updateBank: async (id: number, payload: BankUpdatePayload): Promise<Bank> => {
        const { data } = await api.patch<Bank>(`/treasury/banks/${id}/`, payload)
        return data
    },

    deleteBank: async (id: number): Promise<void> => {
        await api.delete(`/treasury/banks/${id}/`)
    },

    // ========== Movements ==========

    getMovements: async (
        params: Record<string, string | number | boolean>,
        signal?: AbortSignal,
    ): Promise<Page<TreasuryMovement>> => {
        const response = await api.get('/treasury/movements/', { params, signal })
        const pageIndex = Number(params.page ?? 1)
        const pageSize = Number(params.page_size ?? 50)
        return toPage<TreasuryMovement>(response.data, pageIndex, pageSize)
    },

    createMovement: async (payload: MovementCreatePayload): Promise<any> => {
        const { data } = await api.post('/treasury/movements/', payload)
        return data
    },

    // ========== Transfers ==========

    registerTransfer: async (payload: TransferPayload): Promise<any> => {
        const { data } = await api.post('/treasury/dashboard/register_transfer/', payload)
        return data
    },

    // ========== Payments ==========

    createPayment: async (payload: FormData): Promise<any> => {
        const { data } = await api.post('/treasury/payments/', payload, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return data
    },

    updatePayment: async (id: number, payload: PaymentUpdatePayload): Promise<any> => {
        const { data } = await api.patch(`/treasury/payments/${id}/`, payload)
        return data
    },

    // ========== POS Sessions ==========

    getPOSSession: async (id: number): Promise<any> => {
        const response = await api.get(`/treasury/pos-sessions/${id}/`)
        return response.data
    },

    // ========== Monthly Invoices ==========

    generateInvoice: async (formData: FormData): Promise<any> => {
        const { data } = await api.post('/treasury/terminal-batches/generate_invoice/', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return data
    },

    // ========== Contacts (cross-feature) ==========

    getContact: async (id: number): Promise<ContactBrief & Partial<PartnerCapitalInfo>> => {
        const response = await api.get(`/contacts/${id}/`)
        return response.data
    },

    getSuppliers: async (params?: Record<string, string | boolean>): Promise<ContactBrief[]> => {
        const response = await api.get<ContactBrief[]>('/contacts/', { params })
        return response.data
    },

    // ========== Bank Statements ==========

    getStatements: async (filters?: Record<string, unknown>): Promise<Record<string, unknown>[]> => {
        const response = await api.get('/treasury/statements/', { params: filters })
        return response.data.results ?? response.data
    },

    getStatement: async (id: number): Promise<Record<string, unknown>> => {
        const response = await api.get(`/treasury/statements/${id}/`)
        return response.data
    },
}
