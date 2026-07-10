import type { UnifiedSearchConfig } from '@/types/unified-search'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'

export const purchaseOrderUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'supplier_name', label: 'Proveedor', serverParam: 'supplier_name' },
    { key: 'number', label: 'Folio', serverParam: 'number' },
    { key: 'product_name', label: 'Producto', serverParam: 'product_name' },
  ],
  filters: [
    {
      type: 'single',
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
      type: 'single',
      key: 'reception_status',
      label: 'Recepción',
      serverParam: 'receiving_status',
      options: [
        { label: 'Pendiente', value: 'PENDING' },
        { label: 'Parcial', value: 'PARTIAL' },
        { label: 'Recibido', value: 'RECEIVED' },
      ],
    },
    {
      type: 'single',
      key: 'billing_status',
      label: 'Facturación',
      serverParam: 'billing_status',
      options: [
        { label: 'Pendiente', value: 'neutral' },
        { label: 'Facturado', value: 'success' },
      ],
    },
    {
      type: 'single',
      key: 'treasury_status',
      label: 'Tesorería',
      serverParam: 'treasury_status',
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
  dateFilters: [{
    type: 'date',
    key: 'receipt_date',
    label: 'Fecha Entrega',
    options: [
      { label: 'Hoy', serverParamFrom: 'receipt_date_after', serverParamTo: 'receipt_date_before', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'receipt_date_after', serverParamTo: 'receipt_date_before', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'receipt_date_after', serverParamTo: 'receipt_date_before', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'receipt_date_after', serverParamTo: 'receipt_date_before', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'receipt_date_after', serverParamTo: 'receipt_date_before', getValue: thisYear },
    ],
  }],
  basePeriod: { serverParamFrom: 'date_after', serverParamTo: 'date_before' },
}
