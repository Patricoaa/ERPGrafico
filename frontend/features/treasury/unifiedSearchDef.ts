import type { UnifiedSearchConfig } from '@/types/unified-search'
import { format, subDays } from 'date-fns'
import { today, thisWeek, thisMonth, thisQuarter, thisYear, periodPresets } from '@/lib/date-presets'

export const bankUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre / Código',
      serverParam: 'name',
      clientKey: ['name', 'code'],
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'is_active',
      label: 'Estado',
      serverParam: 'is_active',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Archivado', value: 'false' },
      ],
    },
  ],
}

export const paymentMethodUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre',
      serverParam: 'name',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'method_type',
      label: 'Categoría Operativa',
      serverParam: 'method_type',
      options: [
        { label: 'Efectivo Directo', value: 'CASH' },
        { label: 'Tarjeta (terminal de cobro)', value: 'CARD_TERMINAL' },
        { label: 'Transferencia Bancaria', value: 'TRANSFER' },
        { label: 'Tarjeta Débito Empresa', value: 'DEBIT_CARD' },
        { label: 'Tarjeta Crédito Empresa', value: 'CREDIT_CARD' },
        { label: 'Cheque', value: 'CHECK' },
      ],
    },
    {
      type: 'single',
      key: 'is_active',
      label: 'Estado',
      serverParam: 'is_active',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Archivado', value: 'false' },
      ],
    },
  ],
}

export const treasuryAccountUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'name',
      label: 'Nombre',
      serverParam: 'name',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'account_type',
      label: 'Tipología',
      serverParam: 'account_type',
      options: [
        { label: 'Caja Física (Efectivo)', value: 'CASH' },
        { label: 'Cuenta Bancaria', value: 'CHECKING' },
        { label: 'T. Crédito Empresa', value: 'CREDIT_CARD' },
        { label: 'Préstamo Bancario', value: 'LOAN' },
        { label: 'Puente', value: 'BRIDGE' },
        { label: 'Cheques en Cartera', value: 'CHECK_PORTFOLIO' },
      ],
    },
    {
      type: 'single',
      key: 'is_active',
      label: 'Estado',
      serverParam: 'is_active',
      options: [
        { label: 'Activo', value: 'true' },
        { label: 'Archivado', value: 'false' },
      ],
    },
  ],
  groupBy: [
    { key: 'account_type', label: 'Tipo cuenta', field: 'account_type' },
  ],
}

export const terminalBatchUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'batch_number',
      label: 'N° Liquidación',
      serverParam: 'batch_number',
      clientKey: ['batch_number'],
    },
    {
      key: 'provider_name',
      label: 'Proveedor',
      serverParam: 'provider_name',
      clientKey: ['provider_name'],
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Pendiente', value: 'PENDING' },
        { label: 'Liquidado', value: 'SETTLED' },
        { label: 'Conciliado', value: 'RECONCILED' },
        { label: 'Facturado', value: 'INVOICED' },
      ],
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
    { key: 'date', label: 'Fecha', field: 'sales_date' },
    { key: 'status', label: 'Estado', field: 'status' },
  ],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}

export const treasuryMovementsUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Contacto / Referencia',
      serverParam: 'search',
    },
    {
      key: 'display_id',
      label: 'Folio',
      serverParam: 'display_id',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'movement_type',
      label: 'Tipo',
      serverParam: 'movement_type',
      options: [
        { label: 'Depósito', value: 'INBOUND' },
        { label: 'Retiro', value: 'OUTBOUND' },
        { label: 'Traspaso', value: 'TRANSFER' },
        { label: 'Ajuste', value: 'ADJUSTMENT' },
      ],
    },
    {
      type: 'single',
      key: 'payment_method',
      label: 'Método de Pago',
      serverParam: 'payment_method',
      options: [
        { label: 'Efectivo', value: 'CASH' },
        { label: 'Tarjeta (terminal de cobro)', value: 'CARD_TERMINAL' },
        { label: 'Tarjeta (Manual)', value: 'CARD' },
        { label: 'Transferencia', value: 'TRANSFER' },
        { label: 'Cheque', value: 'CHECK' },
        { label: 'Tarjeta Débito Empresa', value: 'DEBIT_CARD' },
        { label: 'Tarjeta Crédito Empresa', value: 'CREDIT_CARD' },
        { label: 'Crédito', value: 'CREDIT' },
        { label: 'Castigo de Deuda', value: 'WRITE_OFF' },
        { label: 'Saldo a Favor', value: 'CREDIT_BALANCE' },
        { label: 'Otro', value: 'OTHER' },
      ],
    },
    {
      type: 'range',
      key: 'amount',
      label: 'Monto',
      serverParamFrom: 'amount_min',
      serverParamTo: 'amount_max',
      placeholderFrom: 'Mín',
      placeholderTo: 'Máx',
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
    { key: 'movement_type', label: 'Tipo movimiento', field: 'movement_type' },
    { key: 'payment_method', label: 'Método de pago', field: 'payment_method' },
  ],
  basePeriod: { serverParamFrom: 'date_from', serverParamTo: 'date_to' },
}

/**
 * Actividad de una sesión POS (filtrado en el cliente sobre los eventos cargados). Las claves
 * `category` y `actor` son campos de la fila; los responsables salen de los propios eventos
 * (`filterOptions.actor`).
 */
export const posSessionActivitySearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'description', label: 'Descripción', serverParam: 'search', clientKey: ['description', 'reference_display'] },
  ],
  filters: [
    {
      type: 'multi',
      key: 'category',
      label: 'Tipo de evento',
      serverParam: 'category',
      options: [
        { label: 'Caja', value: 'caja' },
        { label: 'Venta', value: 'venta' },
        { label: 'Acceso', value: 'acceso' },
        { label: 'Cierre', value: 'cierre' },
        { label: 'Sistema', value: 'sistema' },
      ],
    },
    { type: 'multi', key: 'actor', label: 'Responsable', serverParam: 'actor', options: [], dynamic: true },
  ],
}

/** "Últimos 7 días" date preset of the terminal sales tab: the last 7 days ending today (local). */
function lastSevenDays() {
  const now = new Date()
  return { from: format(subDays(now, 6), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
}

export const terminalSaleUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [],
  filters: [
    { type: 'single', key: 'provider', label: 'Proveedor', serverParam: 'provider', options: [], dynamic: true },
    {
      type: 'single',
      key: 'payment_type',
      label: 'Tipo de pago',
      serverParam: 'payment_type',
      options: [
        { label: 'Efectivo', value: 'CASH' },
        { label: 'Débito', value: 'DEBIT' },
        { label: 'Crédito', value: 'CREDIT' },
        { label: 'Prepago', value: 'PREPAID' },
        { label: 'Sin tipo', value: 'UNKNOWN' },
      ],
    },
    {
      type: 'single',
      key: 'document_type',
      label: 'Tipo de documento',
      serverParam: 'document_type',
      options: [
        { label: '33 · Factura Electrónica', value: '33' },
        { label: '34 · Factura Exenta', value: '34' },
        { label: '39 · Boleta Electrónica', value: '39' },
        { label: '41 · Boleta Exenta', value: '41' },
        { label: '48 · Comprobante de Pago Electrónico', value: '48' },
        { label: '56 · Nota de Débito', value: '56' },
        { label: '61 · Nota de Crédito', value: '61' },
      ],
    },
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Completada', value: 'COMPLETED' },
        { label: 'Anulada', value: 'REVERSED' },
        { label: 'Otro', value: 'OTHER' },
      ],
    },
  ],
  dateFilters: [{
    type: 'date',
    key: 'date',
    label: 'Fecha',
    options: [
      { label: 'Últimos 7 días', serverParamFrom: 'date_from', serverParamTo: 'date_to', getValue: lastSevenDays },
      ...periodPresets('date_from', 'date_to'),
    ],
  }],
}
