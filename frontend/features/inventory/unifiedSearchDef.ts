import type { UnifiedSearchConfig } from '@/types/unified-search'

export const uomUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Nombre / Abreviación',
      serverParam: 'search',
    },
  ],
}

export const categoryUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre',
      serverParam: 'name',
      clientKey: ['name', 'parent_name'],
    },
  ],
}

export const warehouseUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre / Código',
      serverParam: 'name',
      clientKey: ['name', 'code', 'address'],
    },
  ],
}
