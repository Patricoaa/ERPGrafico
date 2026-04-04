import { useState, useCallback } from "react"
import api from "@/lib/api"
import { showApiError } from "@/lib/errors"
import { SaleOrder } from "@/types/entities"

interface UseSaleOrderSearchReturn {
    orders: SaleOrder[]
    singleOrder: SaleOrder | null
    loading: boolean
    fetchOrders: (search?: string) => Promise<void>
    fetchSingleOrder: (id: string | number) => Promise<void>
}

let globalCache: Record<string, SaleOrder[]> = {}

export function useSaleOrderSearch(): UseSaleOrderSearchReturn {
    const [orders, setOrders] = useState<SaleOrder[]>([])
    const [singleOrder, setSingleOrder] = useState<SaleOrder | null>(null)
    const [loading, setLoading] = useState(false)

    const fetchSingleOrder = useCallback(async (id: string | number) => {
        try {
            const res = await api.get(`/sales/orders/${id}/`)
            setSingleOrder(res.data)
        } catch (e) {
            console.error("Error fetching single sale order", e)
        }
    }, [])

    const fetchOrders = useCallback(async (search: string = "") => {
        const cacheKey = search
        if (globalCache[cacheKey]) {
            setOrders(globalCache[cacheKey])
            return
        }

        try {
            setLoading(true)
            const params = new URLSearchParams()
            if (search) params.append("search", search)
            params.append("limit", "50")

            const res = await api.get(`/sales/orders/?${params.toString()}`)
            const data = res.data.results || res.data
            
            globalCache[cacheKey] = data
            setOrders(data)
        } catch (err) {
            showApiError(err, "Error al buscar notas de venta")
            setOrders([])
        } finally {
            setLoading(false)
        }
    }, [])

    return { orders, singleOrder, loading, fetchOrders, fetchSingleOrder }
}
