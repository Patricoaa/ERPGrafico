import { useQuery } from '@tanstack/react-query'
import { ordersApi } from '../api/ordersApi'

const ORDERS_KEYS = {
    warehouses: () => ['orders', 'warehouses'] as const,
    invoice: (id: number) => ['orders', 'invoice', id] as const,
}

export function useNoteLogisticsData(invoiceId: number | null, enabled: boolean) {
    const warehousesQuery = useQuery({
        queryKey: ORDERS_KEYS.warehouses(),
        queryFn: () => ordersApi.getWarehouses(),
        staleTime: 10 * 60 * 1000,
        enabled,
    })

    const invoiceQuery = useQuery({
        queryKey: ORDERS_KEYS.invoice(invoiceId ?? 0),
        queryFn: () => ordersApi.getInvoice(invoiceId!),
        staleTime: 30_000,
        enabled: enabled && !!invoiceId,
    })

    const isLoading = warehousesQuery.isLoading || invoiceQuery.isLoading

    return {
        warehouses: warehousesQuery.data ?? [],
        invoice: invoiceQuery.data ?? null,
        isLoading,
        refetchInvoice: () => invoiceQuery.refetch(),
    }
}
