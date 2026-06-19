import type { SearchDefinition } from '@/types/search'

export const purchaseOrderSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Proveedor',
      type: 'text',
      serverParam: 'search',
    },
  ],
}
