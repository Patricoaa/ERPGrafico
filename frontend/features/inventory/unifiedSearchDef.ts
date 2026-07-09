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

export const uomCategoryUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre',
      serverParam: 'search',
    },
  ],
}

export const attributeUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Nombre',
      serverParam: 'search',
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

export const pricingRuleUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Nombre',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'active',
      label: 'Estado',
      serverParam: 'active',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Inactivo', value: 'false' },
      ],
    },
  ],
}
