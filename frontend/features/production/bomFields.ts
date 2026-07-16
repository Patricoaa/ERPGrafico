import { createEntityFields } from '@/components/shared'
import type { BOM } from './types'
import type { BOMListItem } from './components/BOMClientView'

type BOMFields = BOM & BOMListItem

export const bomFields = createEntityFields<BOMFields>()({
    productName: {
        key: 'product_name',
        type: 'text',
        label: 'Producto',
    },
    name: {
        key: 'name',
        type: 'text',
        label: 'Nombre / Versión',
        tableOptions: { align: 'center' },
    },
    productCode: {
        key: 'product_code',
        type: 'code',
        label: 'Código',
        cardPlacement: 'detail',
        get: (b) => b.product_internal_code || b.product_code || '—',
    },
    linesCount: {
        key: 'lines_count',
        type: 'number',
        label: 'Componentes',
        cardPlacement: 'detail',
        get: (b) => b.lines_count ?? 0,
        tableOptions: { align: 'center' },
    },
    active: {
        key: 'active',
        type: 'status',
        label: 'Estado',
        get: (b) => b.active ? 'active' : 'inactive',
        surfaces: ['card', 'kanban'],
    },
})
