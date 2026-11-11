'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { settingsApi } from '@/features/settings'
import { staleTime } from '@/lib/query-config'
import { useRealtime } from '@/features/realtime'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { PARTNER_KEYS } from './queryKeys'

/** Bodegas disponibles para aportes/retiros de socio en bienes. */
export function usePartnerWarehouses(enabled = true) {
    return useQuery({
        queryKey: PARTNER_KEYS.warehouses(),
        queryFn: () => settingsApi.getWarehouses(),
        staleTime: staleTime.slow,
        enabled,
    })
}

/** Producto elegido para un aporte/retiro en bienes. */
export function usePartnerAssetProduct(productId: string) {
    return useQuery({
        queryKey: PARTNER_KEYS.product(productId),
        queryFn: () => settingsApi.getProduct(productId),
        staleTime: staleTime.standard,
        enabled: !!productId,
    })
}

/** Unidades de medida de la categoría del producto elegido. */
export function usePartnerAssetUoms(category: string | undefined) {
    return useQuery({
        queryKey: PARTNER_KEYS.uoms(category ?? ''),
        queryFn: () => settingsApi.getUoms({ category: category ?? '' }),
        staleTime: staleTime.slow,
        enabled: !!category,
    })
}

/** Ajuste de inventario que respalda un aporte/retiro de socio en bienes. */
export function usePartnerInventoryAdjustment() {
    const queryClient = useQueryClient()
    const { markLocalMutation } = useRealtime()
    return useMutation({
        mutationFn: (payload: Record<string, unknown>) => settingsApi.createInventoryAdjustment(payload),
        onSuccess: () => {
            markLocalMutation()
            invalidateCrossFeature(queryClient, [PARTNER_KEYS.all])
        },
    })
}
