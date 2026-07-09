import type { SearchDefinition } from '@/types/search'

export const stockMoveSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'product_name',
      label: 'Producto',
      type: 'text',
      serverParam: 'product_name',
    },
  ],
}

export const pricingRuleSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre',
      type: 'text',
      serverParam: 'search',
    },
  ],
}

export const subscriptionSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Producto',
      type: 'text',
      serverParam: 'search',
    },
  ],
}

export const attributeSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre',
      type: 'text',
      serverParam: 'search',
    },
  ],
}

export const uomCategorySearchDef: SearchDefinition = {
  fields: [
    {
      key: 'name',
      label: 'Nombre',
      type: 'text',
      serverParam: 'name',
    },
  ],
}

export const productSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre / SKU',
      type: 'text',
      serverParam: 'search',
      suggestionsUrl: 'inventory/products/filter-suggestions/',
    },
  ],
}

export const stockReportSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Producto / SKU',
      type: 'text',
      serverParam: 'search',
      clientKey: ['name', 'code', 'internal_code'],
    },
  ],
}

