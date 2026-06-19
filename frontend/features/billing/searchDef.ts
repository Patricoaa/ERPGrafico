import type { SearchDefinition } from '@/types/search'

export const invoiceSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Cliente / RUT',
      type: 'text',
      serverParam: 'partner_name',
    },
    {
      key: 'number',
      label: 'Folio',
      type: 'text',
      serverParam: 'number',
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
    {
      key: 'number',
      label: 'Folio',
      type: 'text',
      serverParam: 'number',
    },
  ],
}
