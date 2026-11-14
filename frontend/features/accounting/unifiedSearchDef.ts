import type { UnifiedSearchConfig } from '@/types/unified-search'

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

const RCV_FIRST_YEAR = 2017
const RCV_MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

function rcvYearOptions() {
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
}

/** Las ventas no tienen acuse de recibo. */
export const rcvSaleUnifiedSearchDef: UnifiedSearchConfig = {
  ...rcvDocumentUnifiedSearchDef,
  filters: (rcvDocumentUnifiedSearchDef.filters ?? []).filter((f) => f.key !== 'acknowledgement'),
}
