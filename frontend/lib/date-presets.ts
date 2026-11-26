import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, startOfYear, endOfYear, format, subDays, subMonths, subYears, parseISO, differenceInCalendarDays } from 'date-fns'
import { es } from 'date-fns/locale'

const fmt = (d: Date) => format(d, 'yyyy-MM-dd')

export function today() {
  const now = new Date()
  return { from: fmt(startOfDay(now)), to: fmt(endOfDay(now)) }
}

export function thisWeek() {
  const now = new Date()
  return { from: fmt(startOfWeek(now, { weekStartsOn: 1 })), to: fmt(endOfWeek(now, { weekStartsOn: 1 })) }
}

export function thisMonth() {
  const now = new Date()
  return { from: fmt(startOfMonth(now)), to: fmt(endOfMonth(now)) }
}

export function thisQuarter() {
  const now = new Date()
  return { from: fmt(startOfQuarter(now)), to: fmt(endOfQuarter(now)) }
}

export function thisYear() {
  const now = new Date()
  return { from: fmt(startOfYear(now)), to: fmt(endOfYear(now)) }
}

/** The five period presets of a search date filter, sent as `from`/`to` server params. */
/** The last 7 days ending today (local). */
export function lastSevenDays() {
  const now = new Date()
  return { from: format(subDays(now, 6), 'yyyy-MM-dd'), to: format(now, 'yyyy-MM-dd') }
}

export function periodPresets(serverParamFrom: string, serverParamTo: string) {
  return [
    { label: 'Hoy', serverParamFrom, serverParamTo, getValue: today },
    { label: 'Esta semana', serverParamFrom, serverParamTo, getValue: thisWeek },
    { label: 'Este mes', serverParamFrom, serverParamTo, getValue: thisMonth },
    { label: 'Este trimestre', serverParamFrom, serverParamTo, getValue: thisQuarter },
    { label: 'Este año', serverParamFrom, serverParamTo, getValue: thisYear },
  ]
}

export function yearToDate() {
  const now = new Date()
  return { from: fmt(startOfYear(now)), to: fmt(now) }
}

export function lastMonth() {
  const prev = subMonths(new Date(), 1)
  return { from: fmt(startOfMonth(prev)), to: fmt(endOfMonth(prev)) }
}

export function lastYear() {
  const prev = subYears(new Date(), 1)
  return { from: fmt(startOfYear(prev)), to: fmt(endOfYear(prev)) }
}

// ─── Period control (ADR-0160) ────────────────────────────────────────────────

/** A closed period as ISO dates (`yyyy-MM-dd`), the format of list params. */
export interface Period {
  from: string
  to: string
}

/** A named period a `PeriodPicker` / date filter offers; `getValue` is evaluated when shown. */
export interface PeriodPreset {
  label: string
  getValue: () => Period
}

export const PERIOD_PRESETS = {
  today: { label: 'Hoy', getValue: today },
  last_7_days: { label: 'Últimos 7 días', getValue: lastSevenDays },
  this_week: { label: 'Esta semana', getValue: thisWeek },
  this_month: { label: 'Este mes', getValue: thisMonth },
  last_month: { label: 'Mes anterior', getValue: lastMonth },
  this_quarter: { label: 'Este trimestre', getValue: thisQuarter },
  year_to_date: { label: 'Año a la fecha', getValue: yearToDate },
  this_year: { label: 'Este año', getValue: thisYear },
  last_year: { label: 'Año anterior', getValue: lastYear },
} as const satisfies Record<string, PeriodPreset>

export type PeriodPresetId = keyof typeof PERIOD_PRESETS

export const presetsOf = (ids: readonly PeriodPresetId[]): PeriodPreset[] => ids.map((id) => PERIOD_PRESETS[id])

/** Presets of a report period (ADR-0160 §2). */
export const REPORT_PERIOD_PRESETS: readonly PeriodPresetId[] = ['year_to_date', 'this_month', 'last_month', 'this_quarter', 'this_year', 'last_year']

/** Comparison presets relative to `base`: the period just before (same length) and the same dates a year earlier. */
export function comparisonPresets(base: Period | null): PeriodPreset[] {
  if (!base) return []
  const from = parseISO(base.from)
  const to = parseISO(base.to)
  const days = differenceInCalendarDays(to, from) + 1
  const previous = { from: fmt(subDays(from, days)), to: fmt(subDays(from, 1)) }
  const yearBefore = { from: fmt(subYears(from, 1)), to: fmt(subYears(to, 1)) }
  return [
    { label: 'Período anterior', getValue: () => previous },
    { label: 'Mismo período del año anterior', getValue: () => yearBefore },
  ]
}

/** `Date` range (react-day-picker, forms) → `Period`; `null` without a start. A missing end is the start. */
export function periodOf(range: { from?: Date; to?: Date } | null | undefined): Period | null {
  if (!range?.from) return null
  return { from: fmt(range.from), to: fmt(range.to ?? range.from) }
}

/** `Period` → local-midnight `Date`s. */
export function datesOf(period: Period): { from: Date; to: Date } {
  return { from: parseISO(period.from), to: parseISO(period.to) }
}

export const samePeriod = (a: Period | null, b: Period | null) => !!a && !!b && a.from === b.from && a.to === b.to

/** Short label: the matching preset, else «1 ene – 26 nov 2026». */
export function periodLabel(period: Period, presets: readonly PeriodPreset[] = []): string {
  const preset = presets.find((p) => samePeriod(p.getValue(), period))
  if (preset) return preset.label
  const { from, to } = datesOf(period)
  if (period.from === period.to) return format(from, 'd MMM yyyy', { locale: es })
  const sameYear = from.getFullYear() === to.getFullYear()
  return `${format(from, sameYear ? 'd MMM' : 'd MMM yyyy', { locale: es })} – ${format(to, 'd MMM yyyy', { locale: es })}`
}
