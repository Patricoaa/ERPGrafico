import type { UnifiedSearchConfig } from '@/types/unified-search'

export const salesOrderUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'customer_name',
      label: 'Cliente',
      serverParam: 'customer_name',
      suggestionsUrl: 'sales/orders/filter-suggestions/',
    },
    {
      key: 'number',
      label: 'Folio',
      serverParam: 'number',
    },
    {
      key: 'product_name',
      label: 'Producto',
      serverParam: 'product_name',
    },
  ],
  filters: [
    {
      type: 'multi',
      key: 'origin_status',
      label: 'Origen',
      serverParam: 'origin_status',
      options: [
        { label: 'Borrador', value: 'neutral' },
        { label: 'Completado', value: 'success' },
        { label: 'Anulado', value: 'destructive' },
      ],
    },
    {
      type: 'multi',
      key: 'delivery_status',
      label: 'Despacho',
      serverParam: 'delivery_status',
      options: [
        { label: 'Pendiente', value: 'PENDING' },
        { label: 'Parcial', value: 'PARTIAL' },
        { label: 'Entregado', value: 'DELIVERED' },
      ],
    },
    {
      type: 'multi',
      key: 'production_status',
      label: 'Producción',
      serverParam: 'production_status',
      options: [
        { label: 'Sin OT', value: 'none' },
        { label: 'En Proceso', value: 'in_progress' },
        { label: 'Terminada', value: 'finished' },
      ],
    },
    {
      type: 'toggle',
      key: 'billing_status',
      label: 'Facturado',
      serverParam: 'billing_status',
      activeValue: 'success',
    },
    {
      type: 'multi',
      key: 'payment_status',
      label: 'Pago',
      serverParam: 'payment_status',
      options: [
        { label: 'Pendiente', value: 'neutral' },
        { label: 'Parcial', value: 'active' },
        { label: 'Pagado', value: 'success' },
      ],
    },
    {
      type: 'range',
      key: 'total',
      label: 'Monto Total',
      serverParamFrom: 'total_min',
      serverParamTo: 'total_max',
      placeholderFrom: 'Desde',
      placeholderTo: 'Hasta',
    },
  ],
  groupBy: [
    {
      key: 'date',
      label: 'Fecha de creación',
      field: 'date',
      default: true,
      aggregators: [
        { key: 'total', label: 'Total', field: 'total', fn: 'sum', format: 'money' },
        { key: 'count', label: 'Items', fn: 'count', format: 'integer' },
      ],
    },
    {
      key: 'customer',
      label: 'Cliente',
      field: 'customer_name',
    },
  ],
  basePeriod: {
    serverParamFrom: 'date_after',
    serverParamTo: 'date_before',
  },
}

export const salesNoteUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'customer_name',
      label: 'Cliente',
      serverParam: 'customer_name',
      suggestionsUrl: 'sales/orders/filter-suggestions/',
    },
    {
      key: 'number',
      label: 'Folio',
      serverParam: 'number',
    },
  ],
  filters: [
    {
      type: 'multi',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Publicado', value: 'POSTED' },
        { label: 'Pagado', value: 'PAID' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
    {
      type: 'range',
      key: 'total',
      label: 'Monto Total',
      serverParamFrom: 'total_min',
      serverParamTo: 'total_max',
      placeholderFrom: 'Desde',
      placeholderTo: 'Hasta',
    },
  ],
  groupBy: [
    {
      key: 'date',
      label: 'Fecha de creación',
      field: 'date',
      default: true,
      aggregators: [
        { key: 'total', label: 'Total', field: 'total', fn: 'sum', format: 'money' },
        { key: 'count', label: 'Items', fn: 'count', format: 'integer' },
      ],
    },
    {
      key: 'customer',
      label: 'Cliente',
      field: 'customer_name',
    },
  ],
  basePeriod: {
    serverParamFrom: 'date_after',
    serverParamTo: 'date_before',
  },
}
