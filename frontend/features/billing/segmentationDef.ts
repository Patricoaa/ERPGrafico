import type { SegmentationDefinition } from '@/types/segmentation'

export const invoiceSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      variant: 'dropdown',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Emitido', value: 'POSTED' },
        { label: 'Pagado', value: 'PAID' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
    {
      key: 'dte_type',
      label: 'Tipo Doc.',
      type: 'tabs',
      serverParam: 'dte_type',
      variant: 'dropdown',
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
      key: 'total',
      label: 'Monto Total',
      type: 'range',
      serverParamFrom: 'total_min',
      serverParamTo: 'total_max',
      placeholderFrom: 'Desde',
      placeholderTo: 'Hasta',
    },
  ],
}

export const purchaseInvoiceSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      variant: 'dropdown',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Emitido', value: 'POSTED' },
        { label: 'Pagado', value: 'PAID' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
    {
      key: 'total',
      label: 'Monto Total',
      type: 'range',
      serverParamFrom: 'total_min',
      serverParamTo: 'total_max',
      placeholderFrom: 'Desde',
      placeholderTo: 'Hasta',
    },
  ],
}
