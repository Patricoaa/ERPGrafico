import type { UnifiedSearchConfig } from '@/types/unified-search'
import { today, thisWeek, thisMonth, thisQuarter, thisYear } from '@/lib/date-presets'

export const invoiceUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Cliente / RUT',
      serverParam: 'partner_name',
    },
    {
      key: 'number',
      label: 'Folio',
      serverParam: 'number',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Emitido', value: 'POSTED' },
        { label: 'Pagado', value: 'PAID' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
    {
      type: 'single',
      key: 'dte_type',
      label: 'Tipo Doc.',
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
    key: 'date',
    label: 'Fecha',
    options: [
      { label: 'Hoy', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisYear },
    ],
  }],
  groupBy: [
    { key: 'date', label: 'Fecha', field: 'date' },
    { key: 'status', label: 'Estado', field: 'status' },
    { key: 'dte_type', label: 'Tipo documento', field: 'dte_type' },
  ],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}

export const purchaseInvoiceUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Proveedor / RUT',
      serverParam: 'partner_name',
    },
    {
      key: 'number',
      label: 'Folio',
      serverParam: 'number',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Emitido', value: 'POSTED' },
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
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha',
    options: [
      { label: 'Hoy', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: today },
      { label: 'Esta semana', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisWeek },
      { label: 'Este mes', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisMonth },
      { label: 'Este trimestre', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisQuarter },
      { label: 'Este año', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: thisYear },
    ],
  }],
  groupBy: [
    { key: 'date', label: 'Fecha', field: 'date' },
    { key: 'status', label: 'Estado', field: 'status' },
  ],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}
