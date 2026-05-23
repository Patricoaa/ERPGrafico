import { useState, useCallback } from "react"
import { showApiError } from "@/lib/errors"
import { SaleOrder } from "@/types/entities"
import { ordersApi } from "../api/ordersApi"

interface UseSaleOrderSearchReturn {
    orders: SaleOrder[]
    singleOrder: SaleOrder | null
    loading: boolean
    fetchOrders: (search?: string) => Promise<void>
    fetchSingleOrder: (id: string | number) => Promise<void>
}

const globalCache: Record<string, SaleOrder[]> = {}

export function useSaleOrderSearch(): UseSaleOrderSearchReturn {
    const [orders, setOrders] = useState<SaleOrder[]>([])
    const [singleOrder, setSingleOrder] = useState<SaleOrder | null>(null)
    const [loading, setLoading] = useState(false)

    const fetchSingleOrder = useCallback(async (id: string | number) => {
        try {
            const data = await ordersApi.getSaleOrder(id)
            setSingleOrder(data as SaleOrder)
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

            const data = await ordersApi.searchSaleOrders({
                search: search || undefined,
                limit: '50',
            }) as SaleOrder[]
            
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
