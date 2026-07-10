import type { UnifiedSearchConfig, DateFilterDef } from '@/types/unified-search'

const createdDateFilter: DateFilterDef = {
  type: 'date',
  key: 'created_at',
  label: 'Fecha de creación',
  options: [
    {
      label: 'Hoy',
      serverParamFrom: 'date_after',
      serverParamTo: 'date_before',
      getValue: () => {
        const today = new Date().toISOString().split('T')[0]
        return { from: today, to: today }
      },
    },
    {
      label: 'Esta semana',
      serverParamFrom: 'date_after',
      serverParamTo: 'date_before',
      getValue: () => {
        const now = new Date()
        const diff = now.getDay() === 0 ? 6 : now.getDay() - 1
        const monday = new Date(now)
        monday.setDate(now.getDate() - diff)
        const from = monday.toISOString().split('T')[0]
        const to = now.toISOString().split('T')[0]
        return { from, to }
      },
    },
    {
      label: 'Este mes',
      serverParamFrom: 'date_after',
      serverParamTo: 'date_before',
      getValue: () => {
        const now = new Date()
        const from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const to = now.toISOString().split('T')[0]
        return { from, to }
      },
    },
    {
      label: 'Este año',
      serverParamFrom: 'date_after',
      serverParamTo: 'date_before',
      getValue: () => {
        const now = new Date()
        const from = `${now.getFullYear()}-01-01`
        const to = now.toISOString().split('T')[0]
        return { from, to }
      },
    },
  ],
}

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
      type: 'multi',
      key: 'billing_status',
      label: 'Facturación',
      serverParam: 'billing_status',
      options: [
        { label: 'Facturado', value: 'success' },
        { label: 'No Facturado', value: 'pending' },
      ],
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
  dateFilters: [createdDateFilter],
  groupBy: [
    { key: 'date', label: 'Fecha de creación', field: 'date' },
    { key: 'customer', label: 'Cliente', field: 'customer_name' },
    { key: 'status', label: 'Estado', field: 'status' },
    { key: 'channel', label: 'Canal', field: 'channel' },
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
  dateFilters: [createdDateFilter],
  groupBy: [
    { key: 'date', label: 'Fecha de creación', field: 'date' },
    { key: 'customer', label: 'Cliente', field: 'customer_name' },
    { key: 'status', label: 'Estado', field: 'status' },
  ],
}
