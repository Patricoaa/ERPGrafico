import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface Bank {
    id: number
    name: string
    code: string | null
    swift_code?: string | null
    is_active: boolean
}

export const BANKS_QUERY_KEY = ['banks']

export function useBanks() {
    const { data: banks, isLoading, refetch } = useQuery({
        queryKey: BANKS_QUERY_KEY,
        queryFn: async (): Promise<Bank[]> => {
            const response = await api.get('/treasury/banks/')
            return response.data
        },
    })

    return {
        banks: banks ?? [],
        isLoading,
        refetch,
    }
}

export interface PaymentMethod {
    id: number
    name: string
    method_type: string
    method_type_display: string
    treasury_account: number | { id: number; name?: string }
    treasury_account_name: string
    is_active: boolean
    requires_reference: boolean
    allow_for_sales: boolean
    allow_for_purchases: boolean
    is_terminal_integration?: boolean
}

export const PAYMENT_METHODS_QUERY_KEY = ['paymentMethods']

export function usePaymentMethods() {
    const { data: methods, isLoading, refetch } = useQuery({
        queryKey: PAYMENT_METHODS_QUERY_KEY,
        queryFn: async (): Promise<PaymentMethod[]> => {
            const response = await api.get('/treasury/payment-methods/')
            return response.data
        },
    })

    return {
        methods: methods ?? [],
        isLoading,
        refetch,
    }
}
