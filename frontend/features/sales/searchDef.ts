import type { SearchDefinition } from '@/types/search'

export const salesNoteSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'customer_name',
      label: 'Cliente',
      type: 'text',
      serverParam: 'customer_name',
      suggestionsUrl: 'sales/orders/filter-suggestions/',
    },
    {
      key: 'number',
      label: 'Folio',
      type: 'text',
      serverParam: 'number',
    },
  ],
}

export const salesOrderSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'customer_name',
      label: 'Cliente',
      type: 'text',
      serverParam: 'customer_name',
      suggestionsUrl: 'sales/orders/filter-suggestions/',
    },
    {
      key: 'number',
      label: 'Folio',
      type: 'text',
      serverParam: 'number',
    },
    {
      key: 'product_name',
      label: 'Producto',
      type: 'text',
      serverParam: 'product_name',
    },
  ],
}
