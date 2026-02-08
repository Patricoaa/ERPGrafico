import { useState, useEffect } from 'react'
import api from '@/lib/api'

export interface PaymentMethod {
    id: number
    name: string
    method_type: 'CASH' | 'CHECKING' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'CARD_TERMINAL' | 'CHECKBOOK' | 'TRANSFER' | 'CHECK'
    allow_for_sales: boolean
    allow_for_purchases: boolean
    is_active: boolean
}

export interface UseAllowedPaymentMethodsOptions {
    terminalId?: number
    operation?: 'sales' | 'purchases'
    enabled?: boolean
}

export function useAllowedPaymentMethods({ terminalId, operation = 'sales', enabled = true }: UseAllowedPaymentMethodsOptions) {
    const [methods, setMethods] = useState<PaymentMethod[]>([])
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        const fetchMethods = async () => {
            if (!enabled) return

            setLoading(true)
            setError(null)
            try {
                let fetchedMethods: PaymentMethod[] = []

                if (terminalId) {
                    // Fetch allowed methods for this terminal
                    const response = await api.get(`/treasury/pos-terminals/${terminalId}/allowed_payment_methods/`, {
                        params: { operation }
                    })
                    fetchedMethods = response.data
                } else {
                    // Fallback for non-POS contexts (e.g. general sales)
                    // Fetch all active payment methods allowed for the operation
                    // Note: This endpoint might need to be adjusted if there isn't a general 'all methods' endpoint handy
                    // For now we assume we list all active ones
                    const response = await api.get('/treasury/payment_methods/', {
                        params: {
                            is_active: true,
                            // We might need to filter by operation client-side if the API doesn't support it directly on list
                        }
                    })
                    fetchedMethods = response.data.results || response.data

                    if (operation === 'sales') {
                        fetchedMethods = fetchedMethods.filter(m => m.allow_for_sales)
                    } else if (operation === 'purchases') {
                        fetchedMethods = fetchedMethods.filter(m => m.allow_for_purchases)
                    }
                }
                setMethods(fetchedMethods)
            } catch (err: any) {
                console.error("Error fetching allowed payment methods:", err)
                setError(err.message || "Error al cargar métodos de pago")
            } finally {
                setLoading(false)
            }
        }

        fetchMethods()
    }, [terminalId, operation, enabled])

    return { methods, loading, error }
}
