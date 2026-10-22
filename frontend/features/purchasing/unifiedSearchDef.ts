import type { UnifiedSearchConfig } from '@/types/unified-search'
import { periodPresets } from '@/lib/date-presets'

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
  dateFilters: [
    {
      type: 'date',
      key: 'created_at',
      label: 'Fecha de creación',
      options: periodPresets('created_at_after', 'created_at_before'),
    },
    {
      type: 'date',
      key: 'receipt_date',
      label: 'Fecha Entrega',
      options: periodPresets('receipt_date_after', 'receipt_date_before'),
    },
  ],
  groupBy: [
    { key: 'date', label: 'Fecha', field: 'date' },
    { key: 'status', label: 'Estado', field: 'status' },
    { key: 'receiving_status', label: 'Estado recepción', field: 'receiving_status' },
  ],
  basePeriod: { serverParamFrom: 'date_after', serverParamTo: 'date_before' },
}

export const subscriptionUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Producto',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Pausado', value: 'PAUSED' },
        { label: 'Cancelado', value: 'CANCELLED' },
      ],
    },
  ],
  groupBy: [
    { key: 'status', label: 'Estado', field: 'status' },
    { key: 'recurrence_period', label: 'Período', field: 'recurrence_period' },
  ],
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha',
    options: periodPresets('date_from', 'date_to'),
  }],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}


/**
 * ADR-0090: las listas de recepciones y devoluciones de compra son vistas documentales propias.
 * Los `serverParam` coinciden con `PurchaseReceiptFilter` / `PurchaseReturnFilter` del backend.
 */
export const purchaseReceiptUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'purchase_order_number', label: 'Orden de Compra', serverParam: 'purchase_order_number' },
    { key: 'supplier_name', label: 'Proveedor', serverParam: 'supplier_name' },
  ],
  filters: [
    {
      type: 'multi',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Confirmado', value: 'CONFIRMED' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
  ],
  dateFilters: [
    { type: 'date', key: 'receipt_date', label: 'Fecha de recepción', options: periodPresets('date_after', 'date_before') },
  ],
  groupBy: [
    { key: 'date', label: 'Fecha', field: 'receipt_date' },
    { key: 'supplier', label: 'Proveedor', field: 'supplier_name' },
    { key: 'status', label: 'Estado', field: 'status' },
  ],
  basePeriod: { serverParamFrom: 'date_after', serverParamTo: 'date_before' },
}

export const purchaseReturnUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'purchase_order_number', label: 'Orden de Compra', serverParam: 'purchase_order_number' },
    { key: 'supplier_name', label: 'Proveedor', serverParam: 'supplier_name' },
  ],
  filters: [
    {
      type: 'multi',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Confirmado', value: 'CONFIRMED' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
  ],
  dateFilters: [
    { type: 'date', key: 'date', label: 'Fecha de devolución', options: periodPresets('date_after', 'date_before') },
  ],
  groupBy: [
    { key: 'date', label: 'Fecha', field: 'date' },
    { key: 'supplier', label: 'Proveedor', field: 'supplier_name' },
    { key: 'status', label: 'Estado', field: 'status' },
  ],
  basePeriod: { serverParamFrom: 'date_after', serverParamTo: 'date_before' },
}

/**
 * ADR-0090: Unified search for "Recepciones y Devoluciones" (fulfillment).
 * Merges PurchaseReceipt and PurchaseReturn with a `fulfillment_type` filter.
 */
export const purchaseFulfillmentUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'purchase_order_number', label: 'Orden de Compra', serverParam: 'purchase_order_number' },
    { key: 'supplier_name', label: 'Proveedor', serverParam: 'supplier_name' },
  ],
  filters: [
    {
      type: 'multi',
      key: 'fulfillment_type',
      label: 'Tipo',
      serverParam: 'fulfillment_type',
      options: [
        { label: 'Recepción', value: 'RECEIPT' },
        { label: 'Devolución', value: 'RETURN' },
      ],
    },
    {
      type: 'multi',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Confirmado', value: 'CONFIRMED' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
  ],
  dateFilters: [
    { type: 'date', key: 'date', label: 'Fecha', options: periodPresets('date_after', 'date_before') },
  ],
  groupBy: [
    { key: 'date', label: 'Fecha', field: 'date' },
    { key: 'supplier', label: 'Proveedor', field: 'supplier_name' },
    { key: 'status', label: 'Estado', field: 'status' },
    { key: 'type', label: 'Tipo', field: 'fulfillment_type' },
  ],
  basePeriod: { serverParamFrom: 'date_after', serverParamTo: 'date_before' },
}
