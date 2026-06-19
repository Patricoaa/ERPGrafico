import type { SearchDefinition } from '@/types/search'

export const purchaseOrderSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Proveedor',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'number',
      label: 'Folio',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'product',
      label: 'Producto',
      type: 'text',
      serverParam: 'search',
    },
    {
      key: 'total',
      label: 'Total',
      type: 'text',
      serverParam: 'total',
    },
  ],
}
