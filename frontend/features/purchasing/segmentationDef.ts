import type { SegmentationDefinition } from '@/types/segmentation'

export const purchaseOrderSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'origin_status',
      label: 'Origen',
      type: 'tabs',
      serverParam: 'origin_status',
      variant: 'dropdown',
      options: [
        { label: 'Borrador', value: 'neutral' },
        { label: 'Completado', value: 'success' },
        { label: 'Anulado', value: 'destructive' },
      ],
    },
    {
      key: 'reception_status',
      label: 'Recepción',
      type: 'tabs',
      serverParam: 'receiving_status',
      variant: 'dropdown',
      options: [
        { label: 'Pendiente', value: 'PENDING' },
        { label: 'Parcial', value: 'PARTIAL' },
        { label: 'Recibido', value: 'RECEIVED' },
      ],
    },
    {
      key: 'billing_status',
      label: 'Facturación',
      type: 'tabs',
      serverParam: 'billing_status',
      variant: 'dropdown',
      options: [
        { label: 'Pendiente', value: 'neutral' },
        { label: 'Facturado', value: 'success' },
      ],
    },
    {
      key: 'treasury_status',
      label: 'Tesorería',
      type: 'tabs',
      serverParam: 'treasury_status',
      variant: 'dropdown',
      options: [
        { label: 'Pendiente', value: 'neutral' },
        { label: 'Parcial', value: 'active' },
        { label: 'Pagado', value: 'success' },
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
    {
      key: 'receipt_date',
      label: 'Fecha Entrega',
      type: 'date',
      serverParamDate: 'receipt_date',
      serverParamFrom: 'receipt_date_after',
      serverParamTo: 'receipt_date_before',
    },
  ],
}
