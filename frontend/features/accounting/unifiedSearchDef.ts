import type { UnifiedSearchConfig } from '@/types/unified-search'
import { periodPresets } from '@/lib/date-presets'
import { MATCH_STATUS_LABELS } from '@/lib/fiscal-match'

export const accountUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'search',
      label: 'Cuenta / Código',
      serverParam: 'search',
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'account_type',
      label: 'Tipo',
      serverParam: 'account_type',
      options: [
        { label: 'Activo', value: 'ASSET' },
        { label: 'Pasivo', value: 'LIABILITY' },
        { label: 'Patrimonio', value: 'EQUITY' },
        { label: 'Ingresos', value: 'INCOME' },
        { label: 'Gastos', value: 'EXPENSE' },
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
  // No groupBy: the chart of accounts is a tree (the hierarchy is the grouping).
}

export const journalEntryUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    { key: 'search', label: 'Descripción', serverParam: 'search' },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Borrador', value: 'DRAFT' },
        { label: 'Publicado', value: 'POSTED' },
        { label: 'Cerrado', value: 'CLOSED' },
        { label: 'Reversión', value: 'REVERSAL' },
        { label: 'Anulado', value: 'CANCELLED' },
      ],
    },
  ],
  groupBy: [
    { key: 'status', label: 'Estado', field: 'status' },
    { key: 'is_manual', label: 'Origen', field: 'is_manual' },
  ],
  basePeriod: { serverParamFrom: 'date_after', serverParamTo: 'date_before' },
}

export const fiscalYearUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [
    {
      key: 'year',
      label: 'Ejercicio',
      serverParam: 'year',
      clientKey: ['year'],
    },
  ],
  filters: [
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Abierto', value: 'OPEN' },
        { label: 'En Cierre', value: 'CLOSING' },
        { label: 'Cerrado', value: 'CLOSED' },
      ],
    },
  ],
  groupBy: [
    { key: 'status', label: 'Estado', field: 'status' },
  ],
}

export const RCV_FIRST_YEAR = 2017

/** Estados de cuadre que puede tener un documento RCV (`ONLY_ERP` no: es una factura sin documento). */
export const RCV_MATCH_STATUSES = ['MATCHED', 'AMOUNT_DIFF', 'TYPE_DIFF', 'AMBIGUOUS', 'PENDING_ERP', 'ONLY_EXTERNAL', 'EXCLUDED'] as const
export const RCV_MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function rcvYearOptions() {
  const current = new Date().getFullYear()
  return Array.from({ length: current - RCV_FIRST_YEAR + 1 }, (_, i) => {
    const year = String(current - i)
    return { label: year, value: year }
  })
}

/** Filtros del RCV (compras y ventas). Sin período por defecto: lista todo lo importado. */
export const rcvDocumentUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [{ key: 'search', label: 'RUT / Razón social / Folio', serverParam: 'search' }],
  filters: [
    { type: 'single', key: 'year', label: 'Año', serverParam: 'year', options: rcvYearOptions() },
    {
      type: 'single',
      key: 'month',
      label: 'Mes',
      serverParam: 'month',
      options: RCV_MONTH_NAMES.map((label, i) => ({ label, value: String(i + 1) })),
    },
    {
      type: 'single',
      key: 'dte_type',
      label: 'Tipo de documento',
      serverParam: 'dte_type',
      options: [
        { label: '33 · Factura Electrónica', value: '33' },
        { label: '34 · Factura Exenta', value: '34' },
        { label: '39 · Boleta Electrónica', value: '39' },
        { label: '41 · Boleta Exenta', value: '41' },
        { label: '46 · Factura de Compra', value: '46' },
        { label: '52 · Guía de Despacho', value: '52' },
        { label: '56 · Nota de Débito', value: '56' },
        { label: '61 · Nota de Crédito', value: '61' },
      ],
    },
    {
      type: 'single',
      key: 'acknowledgement',
      label: 'Acuse',
      serverParam: 'acknowledgement',
      options: [
        { label: 'Recibo otorgado por el receptor', value: 'Recibo otorgado por el receptor' },
        { label: 'No reclamado en plazo', value: 'No reclamado en plazo' },
      ],
    },
    {
      // Texto del SII (coincidencia exacta). Solo "Confirmada" observado; el resto según el RCV de compras.
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Confirmada', value: 'Confirmada' },
        { label: 'Pendiente', value: 'Pendiente' },
        { label: 'Reclamada', value: 'Reclamada' },
        { label: 'No incluir', value: 'No incluir' },
      ],
    },
    {
      // Cuadre contra el ERP (ADR-0138); la pestaña Cuadre enlaza aquí con este filtro.
      type: 'single',
      key: 'match_status',
      label: 'Cuadre',
      serverParam: 'match_status',
      options: RCV_MATCH_STATUSES.map((value) => ({ label: MATCH_STATUS_LABELS[value], value })),
    },
    {
      type: 'single',
      key: 'missing',
      label: 'Vigencia',
      serverParam: 'missing',
      options: [
        { label: 'No vino en la última importación', value: 'true' },
        { label: 'Vigentes', value: 'false' },
      ],
    },
  ],
  dateFilters: [
    {
      type: 'date',
      key: 'issue_date',
      label: 'Fecha de emisión',
      options: periodPresets('issue_date_from', 'issue_date_to'),
    },
  ],
}

/** Las ventas no tienen acuse de recibo ni estado (el SII lo envía vacío). */
export const rcvSaleUnifiedSearchDef: UnifiedSearchConfig = {
  ...rcvDocumentUnifiedSearchDef,
  filters: (rcvDocumentUnifiedSearchDef.filters ?? []).filter((f) => f.key !== 'acknowledgement' && f.key !== 'status'),
}

/** Filtros del historial de importaciones del RCV. */
export const rcvImportUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [],
  filters: [
    {
      type: 'single',
      key: 'direction',
      label: 'Dirección',
      serverParam: 'direction',
      options: [
        { label: 'Compras', value: 'PURCHASES' },
        { label: 'Ventas', value: 'SALES' },
      ],
    },
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'En cola', value: 'QUEUED' },
        { label: 'En curso', value: 'RUNNING' },
        { label: 'Exitosa', value: 'SUCCESS' },
        { label: 'Fallida', value: 'FAILED' },
      ],
    },
    {
      type: 'single',
      key: 'trigger',
      label: 'Origen',
      serverParam: 'trigger',
      options: [
        { label: 'Automática', value: 'SCHEDULED' },
        { label: 'Manual', value: 'MANUAL' },
      ],
    },
    { type: 'single', key: 'year', label: 'Año', serverParam: 'year', options: rcvYearOptions() },
    {
      type: 'single',
      key: 'month',
      label: 'Mes',
      serverParam: 'month',
      options: RCV_MONTH_NAMES.map((label, i) => ({ label, value: String(i + 1) })),
    },
  ],
}
