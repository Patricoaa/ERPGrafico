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
      key: 'date',
      label: 'Fecha',
      type: 'daterange',
      serverParamStart: 'date_after',
      serverParamEnd: 'date_before',
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
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Confirmado', value: 'CONFIRMED' },
        { label: 'Facturado', value: 'INVOICED' },
        { label: 'Pagado', value: 'PAID' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
    {
      key: 'date',
      label: 'Fecha',
      type: 'daterange',
      serverParamStart: 'date_after',
      serverParamEnd: 'date_before',
    },
  ],
}
