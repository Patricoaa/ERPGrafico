import { createEntityFields } from '@/components/shared'
import { translateProductionStage } from '@/lib/utils'
import type { WorkOrder } from './types'

export const workOrderFields = createEntityFields<WorkOrder>()({
    saleOrderNumber: {
        key: 'sale_order_number',
        type: 'code',
        label: 'OV Asociada',
        get: (w) => w.sale_order_number ?? null,
    },
    startDate: {
        key: 'start_date',
        type: 'date',
        label: 'Fecha Inicio',
    },
    productDescription: {
        key: 'product_description',
        type: 'text',
        label: 'Descripción del Trabajo',
    },
    currentStage: {
        key: 'current_stage',
        type: 'text',
        label: 'Etapa',
        get: (w) => translateProductionStage(w.current_stage),
    },
    dueDate: {
        key: 'due_date',
        type: 'date',
        label: 'Fecha Entrega',
    },
})
