import { createEntityFields } from '@/components/shared'
import { translateProductionStage } from '@/lib/utils'
import type { WorkOrder } from './types'

export const workOrderFields = createEntityFields<WorkOrder>()({
    saleOrderNumber: {
        order: 10,
        key: 'sale_order_number',
        type: 'code',
        label: 'NV Asociada',
        get: (w) => w.sale_order_number ?? null,
        surfaces: ['table'],
    },
    startDate: {
        order: 20,
        key: 'start_date',
        type: 'date',
        label: 'Fecha Inicio',
    },
    productDescription: {
        order: 30,
        key: 'product_description',
        type: 'text',
        label: 'Descripción del Trabajo',
    },
    currentStage: {
        order: 40,
        key: 'current_stage',
        type: 'text',
        label: 'Etapa',
        get: (w) => translateProductionStage(w.current_stage),
    },
    dueDate: {
        order: 50,
        key: 'due_date',
        type: 'date',
        label: 'Fecha Entrega',
    },
})
