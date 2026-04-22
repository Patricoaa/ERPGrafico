import { useState, useCallback } from "react"
import api from "@/lib/api"
import { showApiError } from "@/lib/errors"
import { WorkOrder } from "@/types/entities"

interface UseWorkOrderSearchReturn {
    orders: WorkOrder[]
    singleOrder: WorkOrder | null
    loading: boolean
    fetchOrders: (search?: string) => Promise<void>
    fetchSingleOrder: (id: string | number) => Promise<void>
}

const globalCache: Record<string, WorkOrder[]> = {}

export function useWorkOrderSearch(): UseWorkOrderSearchReturn {
    const [orders, setOrders] = useState<WorkOrder[]>([])
    const [singleOrder, setSingleOrder] = useState<WorkOrder | null>(null)
    const [loading, setLoading] = useState(false)

    const fetchSingleOrder = useCallback(async (id: string | number) => {
        try {
            const res = await api.get(`/production/orders/${id}/`)
            setSingleOrder(res.data)
        } catch (e) {
            console.error("Error fetching single work order", e)
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
            params.append("status_exclude", "CANCELLED")
            params.append("limit", "50")

            const res = await api.get(`/production/orders/?${params.toString()}`)
            const data = res.data.results || res.data
            
            globalCache[cacheKey] = data
            setOrders(data)
        } catch (err) {
            showApiError(err, "Error al buscar órdenes de trabajo")
            setOrders([])
        } finally {
            setLoading(false)
        }
    }, [])

    return { orders, singleOrder, loading, fetchOrders, fetchSingleOrder }
}
