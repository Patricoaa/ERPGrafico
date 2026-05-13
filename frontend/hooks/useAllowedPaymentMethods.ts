import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

export interface PaymentMethod {
    id: number
    name: string
    method_type: 'CASH' | 'CHECKING' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CHECKBOOK' | 'TRANSFER' | 'CHECK' | 'CARD' | 'CARD_TERMINAL' | 'OTHER'
    allow_for_sales: boolean
    allow_for_purchases: boolean
    is_active: boolean
    treasury_account: number
    treasury_account_name: string
    /** true solo para CARD_TERMINAL — activa flujo TUU automatizado en POS */
    is_terminal_integration: boolean
    linked_terminal_device: number | null
}

export interface UseAllowedPaymentMethodsOptions {
    terminalId?: number
    operation?: 'sales' | 'purchases'
    enabled?: boolean
}

export const ALLOWED_PAYMENT_METHODS_KEYS = {
    all: ['allowed_payment_methods'] as const,
    list: (opts: Omit<UseAllowedPaymentMethodsOptions, 'enabled'>) => [...ALLOWED_PAYMENT_METHODS_KEYS.all, opts] as const,
}

export function useAllowedPaymentMethods({ terminalId, operation = 'sales', enabled = true }: UseAllowedPaymentMethodsOptions) {
    const query = useQuery({
        queryKey: ALLOWED_PAYMENT_METHODS_KEYS.list({ terminalId, operation }),
        queryFn: async ({ signal }) => {
            let fetchedMethods: PaymentMethod[] = []

            if (terminalId) {
                const response = await api.get(`/treasury/pos-terminals/${terminalId}/allowed_payment_methods/`, {
                    params: { operation },
                    signal
                })
                fetchedMethods = response.data
            } else {
                const response = await api.get('/treasury/payment-methods/', {
                    params: { is_active: true },
                    signal
                })
                fetchedMethods = response.data.results || response.data

                if (operation === 'sales') {
                    fetchedMethods = fetchedMethods.filter((m: PaymentMethod) => m.allow_for_sales)
                } else if (operation === 'purchases') {
                    fetchedMethods = fetchedMethods.filter((m: PaymentMethod) => m.allow_for_purchases)
                }
            }
            return fetchedMethods
        },
        enabled: enabled,
        staleTime: 5 * 60 * 1000, // 5 min
    })

    return {
        methods: query.data ?? [],
        loading: query.isLoading,
        error: query.error ? (query.error as Error).message : null,
        refetch: query.refetch,
    }
}
