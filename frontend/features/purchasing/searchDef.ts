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
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Confirmado', value: 'CONFIRMED' },
        { label: 'Recibido', value: 'RECEIVED' },
        { label: 'Anulado', value: 'CANCELLED' },
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
