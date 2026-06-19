import type { SearchDefinition } from '@/types/search'

export const invoiceSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Cliente / RUT',
      type: 'text',
      serverParam: 'partner_name',
    },
  ],
}

export const purchaseInvoiceSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Proveedor / RUT',
      type: 'text',
      serverParam: 'partner_name',
    },
  ],
}
