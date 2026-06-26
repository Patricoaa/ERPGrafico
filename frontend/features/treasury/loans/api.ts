import api from '@/lib/api'
import type {
    BankLoan, BankLoanCreatePayload, PayInstallmentPayload,
    PrepayLoanPayload, DisburseLoanPayload, LoanInstallment,
} from './types'

export const loansApi = {
    list: async (params?: Record<string, string>): Promise<BankLoan[]> => {
        const { data } = await api.get<{ results: BankLoan[] }>('/treasury/loans/', { params })
        return data.results
    },

    get: async (id: number): Promise<BankLoan> => {
        const { data } = await api.get<BankLoan>(`/treasury/loans/${id}/`)
        return data
    },

    create: async (payload: BankLoanCreatePayload): Promise<BankLoan> => {
        const { data } = await api.post<BankLoan>('/treasury/loans/', payload)
        return data
    },

    update: async (id: number, payload: Partial<BankLoanCreatePayload>): Promise<BankLoan> => {
        const { data } = await api.patch<BankLoan>(`/treasury/loans/${id}/`, payload)
        return data
    },

    disburse: async (id: number, payload?: DisburseLoanPayload): Promise<BankLoan> => {
        const { data } = await api.post<BankLoan>(`/treasury/loans/${id}/disburse/`, payload ?? {})
        return data
    },

    prepay: async (id: number, payload: PrepayLoanPayload): Promise<BankLoan> => {
        const { data } = await api.post<BankLoan>(`/treasury/loans/${id}/prepay/`, payload)
        return data
    },

    schedule: async (id: number) => {
        const { data } = await api.get<{
            currency: string
            monthly_rate: string
            installments: Array<{
                number: number
                due_date: string
                principal_amount: string
                interest_amount: string
                insurance_amount: string
                total_amount: string
                outstanding_balance: string
            }>
        }>(`/treasury/loans/${id}/schedule/`)
        return data
    },

    amortizationTable: async (id: number): Promise<BankLoan> => {
        const { data } = await api.get<BankLoan>(`/treasury/loans/${id}/amortization_table/`)
        return data
    },

    listInstallments: async (params?: Record<string, string>): Promise<LoanInstallment[]> => {
        const { data } = await api.get<{ results: LoanInstallment[] }>('/treasury/loan-installments/', { params })
        return data.results
    },

    payInstallment: async (id: number, payload: PayInstallmentPayload): Promise<LoanInstallment> => {
        const { data } = await api.post<LoanInstallment>(`/treasury/loan-installments/${id}/pay/`, payload)
        return data
    },
}
