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
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Emitido', value: 'POSTED' },
        { label: 'Pagado', value: 'PAID' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
    {
      key: 'dte_type',
      label: 'Tipo documento',
      type: 'enum',
      serverParam: 'dte_type',
      options: [
        { label: 'Factura', value: 'FACTURA' },
        { label: 'Boleta', value: 'BOLETA' },
        { label: 'Nota de crédito', value: 'NOTA_CREDITO' },
        { label: 'Nota de débito', value: 'NOTA_DEBITO' },
        { label: 'Guía de despacho', value: 'GUIA_DESPACHO' },
        { label: 'Factura exenta', value: 'FACTURA_EXENTA' },
        { label: 'Boleta exenta', value: 'BOLETA_EXENTA' },
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

export const purchaseInvoiceSearchDef: SearchDefinition = {
  fields: [
    {
      key: 'search',
      label: 'Proveedor / RUT',
      type: 'text',
      serverParam: 'partner_name',
    },
    {
      key: 'status',
      label: 'Estado',
      type: 'enum',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Emitido', value: 'POSTED' },
        { label: 'Pagado', value: 'PAID' },
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
