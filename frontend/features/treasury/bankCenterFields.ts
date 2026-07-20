import { createEntityFields } from '@/components/shared'
import type { Bank } from '@/features/treasury/types'

export const bankCenterFields = createEntityFields<Bank>()({
    name: { key: 'name', type: 'text', label: 'Nombre' },
    code: { key: 'code', type: 'text', label: 'Código' },
    is_active: { key: 'is_active', type: 'status', label: 'Estado', get: (row) => row.is_active ? 'active' : 'inactive', getLabel: (row) => row.is_active ? 'Activo' : 'Archivado' },
})
