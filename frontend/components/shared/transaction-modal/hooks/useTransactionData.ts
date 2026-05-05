import { useState, useCallback, useEffect } from "react"
import { toast } from "sonner"
import type { TransactionType, TransactionData } from "@/types/transactions"
import api from "@/lib/api"
import { showApiError } from "@/lib/errors"

export const ENDPOINT_MAP: Record<string, (id: number | string) => string> = {
    sale_order: (id) => `/sales/orders/${id}/`,
    purchase_order: (id) => `/purchasing/orders/${id}/`,
    invoice: (id) => `/billing/invoices/${id}/`,
    payment: (id) => `/treasury/payments/${id}/`,
    journal_entry: (id) => `/accounting/entries/${id}/`,
    inventory: (id) => `/inventory/moves/${id}/`,
    stock_move: (id) => `/inventory/moves/${id}/`,
    work_order: (id) => `/production/orders/${id}/`,
    sale_delivery: (id) => `/sales/deliveries/${id}/`,
    purchase_receipt: (id) => `/purchasing/receipts/${id}/`,
    sale_return: (id) => `/sales/returns/${id}/`,
    purchase_return: (id) => `/purchasing/returns/${id}/`,
    cash_movement: (id) => `/treasury/cash-movements/${id}/`,
    user: (id) => `/users/${id}/`,
    contact: (id) => `/directory/contacts/${id}/`,
    product: (id) => `/inventory/products/${id}/`,
    profit_distribution: (id) => `/contacts/profit-distributions/${id}/`,
    terminal_batch: (id) => `/treasury/terminal-batches/${id}/`,
}

interface UseTransactionDataOptions {
    type: TransactionType
    id: number | string
    enabled: boolean
}

export function useTransactionData({ type, id, enabled }: UseTransactionDataOptions) {
    const [data, setData] = useState<TransactionData | null>(null)
    const [loading, setLoading] = useState(false)

    const fetchData = useCallback(async () => {
        if (!id || id === 0 || id === '0') return

        const getEndpoint = ENDPOINT_MAP[type.toLowerCase()]
        if (!getEndpoint) {
            console.error(`[TransactionViewModal] No endpoint configured for type: ${type}`)
            return
        }

        try {
            setLoading(true)
            const response = await api.get(getEndpoint(id))
            setData(response.data)
        } catch (error) {
            showApiError(error, "Error al cargar la transacción")
        } finally {
            setLoading(false)
        }
    }, [id, type])

    useEffect(() => {
        if (enabled && id && id !== 0 && id !== '0') {
            fetchData()
        }
        if (!enabled) {
            setData(null)
            setLoading(false)
        }
    }, [enabled, id, type, fetchData])

    return {
        data,
        loading,
        refetch: fetchData
    }
}
