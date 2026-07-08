import type { SegmentationDefinition } from '@/types/segmentation'

export const salesOrderSegDef: SegmentationDefinition = {
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
      key: 'delivery_status',
      label: 'Despacho',
      type: 'tabs',
      serverParam: 'delivery_status',
      variant: 'dropdown',
      options: [
        { label: 'Pendiente', value: 'PENDING' },
        { label: 'Parcial', value: 'PARTIAL' },
        { label: 'Entregado', value: 'DELIVERED' },
      ],
    },
    {
      key: 'production_status',
      label: 'Producción',
      type: 'tabs',
      serverParam: 'production_status',
      variant: 'dropdown',
      options: [
        { label: 'Sin OT', value: 'none' },
        { label: 'En Proceso', value: 'in_progress' },
        { label: 'Terminada', value: 'finished' },
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
      key: 'payment_status',
      label: 'Pago',
      type: 'tabs',
      serverParam: 'payment_status',
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
  ],
}

export const salesNoteSegDef: SegmentationDefinition = {
  segments: [
    {
      key: 'status',
      label: 'Estado',
      type: 'tabs',
      serverParam: 'status',
      variant: 'dropdown',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Publicado', value: 'POSTED' },
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
