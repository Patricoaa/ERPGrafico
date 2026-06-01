'use client'

import { useQuery } from '@tanstack/react-query'
import { productionApi } from '../api/productionApi'
import { PRODUCTION_METRICS_KEY } from './queryKeys'
import { ACCOUNTING_SETTINGS_KEY } from './queryKeys'

export interface ProductionMetrics {
    avg_time_by_stage: Record<string, number>
    ots_by_stage: Record<string, number>
    overdue_ots: number
    throughput_last_30d: number
}

export function useProductionMetrics() {
    return useQuery<ProductionMetrics>({
        queryKey: PRODUCTION_METRICS_KEY,
        queryFn: productionApi.getProductionMetrics,
        refetchInterval: 60000,
    })
}

export function useAllowedDteTypes() {
    return useQuery({
        queryKey: ACCOUNTING_SETTINGS_KEY,
        queryFn: async () => {
            const data = await productionApi.getAccountingSettings()
            return (data as { allowed_dte_types_receive?: string[] }).allowed_dte_types_receive || ["FACTURA", "BOLETA"]
        },
        staleTime: 1000 * 60 * 60,
    })
}

export function useCoreAllowedDteTypes() {
    return useQuery({
        queryKey: ['settings', 'general'],
        queryFn: async () => {
            const data = await productionApi.getCoreSettings()
            return (data as { allowed_dte_types_receive?: string[] }).allowed_dte_types_receive || ["FACTURA", "BOLETA"]
        },
        staleTime: 1000 * 60 * 60,
    })
}
