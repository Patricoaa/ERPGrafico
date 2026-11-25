import { formatNumber } from '@/components/entity-view'
import type { MultiSelectOption } from '@/types/unified-search'
import { FISCAL_MATCH_STATUS_LABELS, type FiscalMatchStatus } from '@/lib/fiscal-match'
import type { FiscalMatchCounts, FiscalMatchDirection, FiscalMatchFilters } from './types/fiscalMatch'

/** Orden fijo de los estados (conteos y filtro). */
export const FISCAL_MATCH_STATUSES: readonly FiscalMatchStatus[] = [
  'MATCHED', 'PENDING', 'DIFF', 'AMBIGUOUS', 'MISSING_ERP', 'MISSING_EXTERNAL', 'EXCLUDED',
]
/** Estados que no requieren atención; «necesita atención» es todo lo demás. */
export const SETTLED_STATUSES: readonly FiscalMatchStatus[] = ['MATCHED', 'EXCLUDED']

/** Valores del parámetro `status` de la URL además de un estado: sin parámetro = «attention». */
export const STATUS_ATTENTION = 'attention'
export const STATUS_ALL = 'all'
export const DIRECTION_ALL = 'all'
export const DEFAULT_DIRECTION: FiscalMatchDirection = 'sale'

/** `Ambos` omite el parámetro `direction`: el backend devuelve ventas y compras juntas. */
export const DIRECTION_OPTIONS: { label: string; value: FiscalMatchDirection | typeof DIRECTION_ALL }[] = [
  { label: 'Ventas', value: 'sale' },
  { label: 'Compras', value: 'purchase' },
  { label: 'Ambos', value: DIRECTION_ALL },
]

/** Opciones del filtro de estado con los conteos de la URL actual, dentro del unified search. */
export function fiscalMatchStatusOptions(counts: FiscalMatchCounts): MultiSelectOption[] {
  const byStatus = counts.by_status
  const attention = FISCAL_MATCH_STATUSES.reduce(
    (sum, s) => (SETTLED_STATUSES.includes(s) ? sum : sum + (byStatus[s] ?? 0)), 0,
  )
  const total = FISCAL_MATCH_STATUSES.reduce((sum, s) => sum + (byStatus[s] ?? 0), 0)
  return [
    { label: `Necesita atención (${formatNumber(attention)})`, value: STATUS_ATTENTION },
    ...FISCAL_MATCH_STATUSES.map((value) => ({
      label: `${FISCAL_MATCH_STATUS_LABELS[value]} (${formatNumber(byStatus[value] ?? 0)})`,
      value,
    })),
    { label: `Todos (${formatNumber(total)})`, value: STATUS_ALL },
  ]
}

/** Opciones del filtro de estado mientras cargan los conteos. */
export const FISCAL_MATCH_STATUS_OPTIONS: MultiSelectOption[] = [
  { label: 'Necesita atención', value: STATUS_ATTENTION },
  ...FISCAL_MATCH_STATUSES.map((value) => ({ label: FISCAL_MATCH_STATUS_LABELS[value], value })),
  { label: 'Todos', value: STATUS_ALL },
]

/** Tipos de DTE que cruza el cuadre. */
export const FISCAL_MATCH_DTE_OPTIONS = [
  { label: '33 · Factura Electrónica', value: '33' },
  { label: '34 · Factura Exenta', value: '34' },
  { label: '39 · Boleta Electrónica', value: '39' },
  { label: '41 · Boleta Exenta', value: '41' },
  { label: '46 · Factura de Compra', value: '46' },
  { label: '48 · Comprobante de pago electrónico', value: '48' },
  { label: '56 · Nota de Débito', value: '56' },
  { label: '61 · Nota de Crédito', value: '61' },
]

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

/**
 * La URL con los filtros por defecto que le faltan (`direction=sale`, `status=attention`), o
 * `null` si ya los trae. Escritos en la URL, el buscador los muestra como chips y selecciones.
 */
export function withDefaultFilters(query: string): string | null {
  const params = new URLSearchParams(query)
  if (params.has('direction') && params.has('status')) return null
  if (!params.has('direction')) params.set('direction', DEFAULT_DIRECTION)
  if (!params.has('status')) params.set('status', STATUS_ATTENTION)
  return params.toString()
}

/** Parámetros de la URL → filtros de la API. Los vacíos se omiten; «Ambos» no envía `direction`. */
export function toFiscalMatchFilters(params: Record<string, string>): FiscalMatchFilters {
  const status = selectedStatus(params)
  const filters: FiscalMatchFilters = {}
  if (params.direction !== DIRECTION_ALL) {
    filters.direction = params.direction === 'purchase' ? 'purchase' : DEFAULT_DIRECTION
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
