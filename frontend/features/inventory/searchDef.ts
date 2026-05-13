import type { SearchDefinition } from '@/types/search'

export const stockMoveSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'product_name',
      label: 'Producto',
      type: 'text',
      serverParam: 'product_name',
    },
    {
      key: 'move_type',
      label: 'Tipo',
      type: 'enum',
      serverParam: 'move_type',
      options: [
        { label: 'Entrada', value: 'IN' },
        { label: 'Salida', value: 'OUT' },
        { label: 'Ajuste', value: 'ADJ' },
      ],
    },
    {
      key: 'date',
      label: 'Fecha',
      type: 'daterange',
      serverParamStart: 'date_from',
      serverParamEnd: 'date_to',
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
    {
      key: 'active',
      label: 'Estado',
      type: 'enum',
      serverParam: 'active',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Inactivo', value: 'false' },
      ],
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
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Pausado', value: 'PAUSED' },
        { label: 'Cancelado', value: 'CANCELLED' },
      ],
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
    {
      key: 'product_type',
      label: 'Tipo',
      type: 'enum',
      serverParam: 'product_type',
      options: [
        { label: 'Almacenable', value: 'STORABLE' },
        { label: 'Consumible', value: 'CONSUMABLE' },
        { label: 'Servicio', value: 'SERVICE' },
        { label: 'Fabricable', value: 'MANUFACTURABLE' },
        { label: 'Suscripción', value: 'SUBSCRIPTION' },
      ],
    },
  ],
}
