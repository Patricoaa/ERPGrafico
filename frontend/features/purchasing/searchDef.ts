import type { SearchDefinition } from '@/types/search'

export const purchaseOrderSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'supplier_name',
      label: 'Proveedor',
      type: 'text',
      serverParam: 'supplier_name',
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
