import { createEntityFields } from '@/components/shared'

export interface UoMCategory {
    id: number
    name: string
}

export const uomCategoryFields = createEntityFields<UoMCategory>()({
    id: { key: 'id', type: 'code', label: 'Código' },
    name: { key: 'name', type: 'text', label: 'Nombre' },
})
