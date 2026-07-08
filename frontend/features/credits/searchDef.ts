import type { SearchDefinition } from '@/types/search'

export const creditContactSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Cliente / RUT',
      type: 'text',
      serverParam: 'search',
      clientKey: ['name', 'tax_id'],
    },
  ],
}

export const creditHistorySearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Cliente / Folio',
      type: 'text',
      serverParam: 'search',
      clientKey: ['customer_name', 'number', 'display_id'],
    },
  ],
}
