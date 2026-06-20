export interface DateGroup<T> {
  dateKey: string
  date: Date
  label: string
  sublabel: string
  items: T[]
  total: number
}

function parseSafeDate(value: unknown): Date | null {
  if (value == null || value === "") return null
  const d = new Date(String(value))
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

export function groupByDate<T>(
  items: T[],
  dateField: string,
  amountField?: string,
): DateGroup<T>[] {
  const now = new Date()
  const nowKey = normalizeDateKey(now)
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayKey = normalizeDateKey(yesterday)

  const groups = new Map<string, T[]>()
  const noDateItems: T[] = []

  for (const item of items) {
    const raw = (item as Record<string, unknown>)[dateField]
    const date = parseSafeDate(raw)
    if (!date) {
      noDateItems.push(item)
      continue
    }
    const key = normalizeDateKey(date)
    const bucket = groups.get(key) ?? []
    bucket.push(item)
    groups.set(key, bucket)
  }

  const sortedKeys = Array.from(groups.keys()).sort().reverse()
  const result: DateGroup<T>[] = sortedKeys.map((key) => {
    const groupItems = groups.get(key) ?? []
    const total = amountField
      ? groupItems.reduce((sum, item) => {
          const val = (item as Record<string, unknown>)[amountField]
          const num = typeof val === "number" ? val : Number(val) || 0
          return sum + num
        }, 0)
      : 0

    const { label, sublabel } = getDateLabelAndSublabel(
      key,
      nowKey,
      yesterdayKey,
    )
    return {
      dateKey: key,
      date: new Date(key + "T12:00:00"),
      label,
      sublabel,
      items: groupItems,
      total,
    }
  })

  if (noDateItems.length > 0) {
    result.push({
      dateKey: "",
      date: new Date(0),
      label: "Sin fecha",
      sublabel: "",
      items: noDateItems,
      total: 0,
    })
  }

  return result
}
