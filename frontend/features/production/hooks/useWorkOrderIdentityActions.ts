import { useMutation } from '@tanstack/react-query'
import { showApiError } from '@/lib/errors'
import { productionApi } from '../api/productionApi'

export interface RestartResult {
    initial_data: {
        sale_order_id: number | null
        sale_order_number: string | null
        sale_line_id: number | null
        product_id: number | null
        stage_data: Record<string, unknown>
        ot_type: 'LINKED' | 'NONE'
    }
}

export interface CorrectionResult {
    id: number
    display_id: string
}

export function useWorkOrderIdentityActions(orderId: number) {
    const restartMutation = useMutation<RestartResult>({
        mutationFn: () => productionApi.restartWorkOrder(orderId) as Promise<RestartResult>,
        onError: (err) => showApiError(err, 'Error al reiniciar la OT'),
    })

    const correctionMutation = useMutation<CorrectionResult>({
        mutationFn: () => productionApi.duplicateWorkOrder(orderId) as Promise<CorrectionResult>,
        onError: (err) => showApiError(err, 'Error al crear OT corregida'),
    })

    return {
        restart: restartMutation.mutateAsync,
        createCorrection: correctionMutation.mutateAsync,
        isRestarting: restartMutation.isPending,
        isCreatingCorrection: correctionMutation.isPending,
    }
}
