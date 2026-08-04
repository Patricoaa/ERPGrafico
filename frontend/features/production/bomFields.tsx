import { createEntityFields } from '@/components/shared'
import { Layers } from 'lucide-react'
import type { BOM } from './types'
import type { BOMListItem } from './components/BOMClientView'
import {Chip} from '@/components/shared'

type BOMFields = BOM & BOMListItem

export const bomFields = createEntityFields<BOMFields>()({
    productName: {
        key: 'product_name',
        type: 'computed',
        label: 'Producto',
        tableOptions: { align: 'center' },
        render: (b) => (
            <div className="flex flex-col items-center gap-1 py-1">
                <span className="font-medium text-xs leading-tight text-center">{b.product_name}</span>
                <div className="flex flex-wrap justify-center gap-1">
                    {b.product_internal_code && (
                        <Chip size="xs" intent="neutral" className="font-normal opacity-80 text-center">
                            {b.product_internal_code}
                        </Chip>
                    )}
                    {b.product_code && b.product_code !== b.product_internal_code && (
                        <Chip size="xs" intent="neutral" className="font-normal opacity-80 text-center">
                            {b.product_code}
                        </Chip>
                    )}
                </div>
            </div>
        ),
    },
    name: {
        key: 'name',
        type: 'text',
        label: 'Nombre / Versión',
        tableOptions: { align: 'center' },
    },
    linesCount: {
        key: 'lines_count',
        type: 'chip',
        label: 'Componentes',
        get: (b) => String(b.lines_count ?? 0),
        chipIcon: Layers,
    },
    totalCost: {
        key: 'total_cost',
        type: 'currency',
        label: 'Costo Total',
        get: (b) => parseFloat(String(b.total_cost)) || 0,
        tableOptions: { align: 'center' },
        className: 'font-mono',
    },
    active: {
        key: 'active',
        type: 'status',
        label: 'Estado',
        get: (b) => b.active ? 'active' : 'inactive',
        getLabel: (b) => b.active ? 'Activa' : 'Inactiva',
    },
})
