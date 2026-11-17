import type { UnifiedSearchConfig } from '@/types/unified-search'
import { periodPresets } from '@/lib/date-presets'
import { FISCAL_MATCH_STATUS_LABELS, type FiscalMatchStatus } from '@/lib/fiscal-match'
import type { FiscalMatchDirection, FiscalMatchFilters } from './types/fiscalMatch'

/** Orden fijo de los estados (conteos y filtro). */
export const FISCAL_MATCH_STATUSES: readonly FiscalMatchStatus[] = [
  'MATCHED', 'PENDING', 'DIFF', 'AMBIGUOUS', 'MISSING_ERP', 'MISSING_EXTERNAL', 'EXCLUDED',
]
/** Estados que no requieren atención; «necesita atención» es todo lo demás. */
export const SETTLED_STATUSES: readonly FiscalMatchStatus[] = ['MATCHED', 'EXCLUDED']

/** Valores del parámetro `status` de la URL además de un estado: sin parámetro = «attention». */
export const STATUS_ATTENTION = 'attention'
export const STATUS_ALL = 'all'
export const DEFAULT_DIRECTION: FiscalMatchDirection = 'sale'

/**
 * Filtros de la página Cuadre. Sin `direction` ni `status` en la URL valen los por defecto
 * (ventas, necesita atención); «Todos» (`status=all`) quita el filtro de estado.
 */
export const fiscalMatchUnifiedSearchDef: UnifiedSearchConfig = {
  searchFields: [{ key: 'search', label: 'Folio / RUT / Monto', serverParam: 'search' }],
  filters: [
    {
      type: 'single',
      key: 'direction',
      label: 'Dirección',
      serverParam: 'direction',
      options: [
        { label: 'Ventas', value: 'sale' },
        { label: 'Compras', value: 'purchase' },
      ],
    },
    {
      type: 'single',
      key: 'status',
      label: 'Estado',
      serverParam: 'status',
      options: [
        { label: 'Necesita atención', value: STATUS_ATTENTION },
        ...FISCAL_MATCH_STATUSES.map((value) => ({ label: FISCAL_MATCH_STATUS_LABELS[value], value })),
        { label: 'Todos', value: STATUS_ALL },
      ],
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
        { label: '48 · Comprobante de pago electrónico', value: '48' },
        { label: '56 · Nota de Débito', value: '56' },
        { label: '61 · Nota de Crédito', value: '61' },
      ],
    },
  ],
  dateFilters: [
    { type: 'date', key: 'issue_date', label: 'Fecha', options: periodPresets('date_from', 'date_to') },
  ],
}

const isStatus = (v: string | undefined): v is FiscalMatchStatus =>
  !!v && (FISCAL_MATCH_STATUSES as readonly string[]).includes(v)
const isIsoDate = (v: string | undefined): v is string => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v)
const toInt = (v: string | undefined): number | undefined => {
  const n = Number(v)
  return v && Number.isInteger(n) && n > 0 ? n : undefined
}

/** Valor efectivo del parámetro `status` (sin parámetro o desconocido = «attention»). */
export function selectedStatus(params: Record<string, string>): FiscalMatchStatus | typeof STATUS_ATTENTION | typeof STATUS_ALL {
  const v = params.status
  if (v === STATUS_ALL) return STATUS_ALL
  return isStatus(v) ? v : STATUS_ATTENTION
}

/** Parámetros de la URL → filtros de la API. Los vacíos se omiten. */
export function toFiscalMatchFilters(params: Record<string, string>): FiscalMatchFilters {
  const status = selectedStatus(params)
  const filters: FiscalMatchFilters = {
    direction: params.direction === 'purchase' ? 'purchase' : DEFAULT_DIRECTION,
  }
  if (status !== STATUS_ALL) filters.status = [status]
  const dteType = toInt(params.dte_type)
  if (dteType) filters.dte_type = dteType
  if (isIsoDate(params.date_from)) filters.date_from = params.date_from
  if (isIsoDate(params.date_to)) filters.date_to = params.date_to
  const search = params.search?.trim()
  if (search) filters.search = search
  return filters
}
