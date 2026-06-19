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

export const uomSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Nombre / Abreviación',
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

export const categorySearchDef: SearchDefinition = {
  fields: [
    {
      key: 'name',
      label: 'Nombre',
      type: 'text',
      serverParam: 'name',
      clientKey: ['name', 'parent_name'],
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

export const warehouseSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'name',
      label: 'Nombre / Código',
      type: 'text',
      serverParam: 'name',
      clientKey: ['name', 'code', 'address'],
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
    {
      key: 'category_name',
      label: 'Categoría',
      type: 'text',
      serverParam: 'category_name',
      clientKey: ['category_name'],
    },
  ],
}

