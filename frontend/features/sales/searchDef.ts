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
  ],
}
