export type AggregateFn = 'sum' | 'count' | 'avg' | 'min' | 'max'
export type AggregateFormat = 'money' | 'number' | 'integer'

export interface AggregatorDef {
  key: string
  label: string
  field?: string
  fn: AggregateFn
  format?: AggregateFormat
}

export interface Group<T> {
  key: string
  rawKey: unknown
  label: string
  sublabel?: string
  items: T[]
  aggregates: Record<string, number>
}

function parseSafeDate(value: unknown): Date | null {
  if (value == null || value === "") return null
  const s = String(value)
  // date-only string → parse parts to avoid UTC midnight shift
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
  }
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

function normalizeDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

export function getDateLabelAndSublabel(
  dateKey: string,
  nowKey: string,
  yesterdayKey: string,
): { label: string; sublabel: string } {
  const date = new Date(dateKey + "T12:00:00")
  const formatted = date
    .toLocaleDateString("es-CL", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .replace(/\./g, "")

  if (dateKey === nowKey) return { label: "Hoy", sublabel: formatted }
  if (dateKey === yesterdayKey) return { label: "Ayer", sublabel: formatted }

  const diffDays = Math.floor((Date.now() - date.getTime()) / 86400000)
  if (diffDays >= 0 && diffDays < 7) {
    const dayNames = [
      "domingo",
      "lunes",
      "martes",
      "miércoles",
      "jueves",
      "viernes",
      "sábado",
    ]
    return { label: dayNames[date.getDay()], sublabel: formatted }
  }

  return { label: formatted, sublabel: "" }
}

function getFieldValue<T>(item: T, field: string): unknown {
  return (item as Record<string, unknown>)[field]
}

function computeAggregate(values: number[], fn: AggregateFn): number {
  if (values.length === 0) return 0
  switch (fn) {
    case 'sum':
      return values.reduce((a, b) => a + b, 0)
    case 'count':
      return values.length
    case 'avg':
      return values.reduce((a, b) => a + b, 0) / values.length
    case 'min':
      return Math.min(...values)
    case 'max':
      return Math.max(...values)
  }
}

export function groupItems<T>(
  items: T[],
  field: string,
  options?: {
    sort?: 'asc' | 'desc'
    labelFn?: (key: string, rawKey: unknown, items: T[]) => { label: string; sublabel?: string }
    defaultLabel?: string
    parseValue?: (value: unknown) => string | null
  },
  aggregators?: AggregatorDef[],
): Group<T>[] {
  const { sort = 'desc', defaultLabel = 'Sin categoría' } = options ?? {}

  const groups = new Map<string, { items: T[]; rawKey: unknown }>()
  const noKeyItems: T[] = []

  for (const item of items) {
    const raw = getFieldValue(item, field)
    let key: string | null

    if (options?.parseValue) {
      key = options.parseValue(raw)
    } else if (raw == null || raw === '') {
      key = null
    } else {
      key = String(raw)
    }

    if (key === null) {
      noKeyItems.push(item)
      continue
    }

    const bucket = groups.get(key) ?? { items: [], rawKey: raw }
    bucket.items.push(item)
    groups.set(key, bucket)
  }

  const sortedKeys = Array.from(groups.keys()).sort((a, b) => {
    if (sort === 'desc') return b.localeCompare(a)
    return a.localeCompare(b)
  })

  const result: Group<T>[] = sortedKeys.map((key) => {
    const bucket = groups.get(key) as { items: T[]; rawKey: unknown }
    const { items: groupItems, rawKey } = bucket

    let label: string
    let sublabel: string | undefined
    if (options?.labelFn) {
      const result = options.labelFn(key, rawKey, groupItems)
      label = result.label
      sublabel = result.sublabel
    } else {
      label = String(rawKey)
    }

    const aggregates: Record<string, number> = {}
    if (aggregators) {
      for (const agg of aggregators) {
        if (agg.fn === 'count' && !agg.field) {
          aggregates[agg.key] = groupItems.length
          continue
        }
        const aggField = agg.field
        if (aggField) {
          const values = groupItems.map((item) => {
            const val = getFieldValue(item, aggField)
            return typeof val === 'number' ? val : Number(val) || 0
          })
          aggregates[agg.key] = computeAggregate(values, agg.fn)
        }
      }
    }

    return { key, rawKey, label, sublabel, items: groupItems, aggregates }
  })

  if (noKeyItems.length > 0) {
    result.push({
      key: '',
      rawKey: null,
      label: defaultLabel,
      sublabel: undefined,
      items: noKeyItems,
      aggregates: {},
    })
  }

  return result
}

export function groupByDate<T>(
  items: T[],
  dateField: string,
  aggregators?: AggregatorDef[],
): Group<T>[] {
  const now = new Date()
  const nowKey = normalizeDateKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = normalizeDateKey(yesterday)

  return groupItems(
    items,
    dateField,
    {
      sort: 'desc',
      defaultLabel: 'Sin fecha',
      parseValue: (value: unknown) => {
        const date = parseSafeDate(value)
        if (!date) return null
        return normalizeDateKey(date)
      },
      labelFn: (key: string) => getDateLabelAndSublabel(key, nowKey, yesterdayKey),
    },
    aggregators,
  )
}
