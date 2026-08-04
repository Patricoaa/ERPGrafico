import { parseDateOnly } from "@/lib/utils"

export type Granularity = "day" | "month" | "year"

export function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const map: Record<string, T[]> = {}
  if (!Array.isArray(items)) return map
  for (const item of items) {
    const key = keyFn(item)
    if (!map[key]) map[key] = []
    map[key].push(item)
  }
  return map
}

const MONTHS_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
]

export function formatMonth(dateStr: string): string {
  const d = parseDateOnly(dateStr)
  return `${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`
}

export function formatYear(dateStr: string): string {
  return parseDateOnly(dateStr).getFullYear().toString()
}

export function formatDay(dateStr: string): string {
  const d = parseDateOnly(dateStr)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  return `${dd}/${mm}`
}

export function granularityKey(dateStr: string, g: Granularity): string {
  if (g === "day") return formatDay(dateStr)
  if (g === "year") return formatYear(dateStr)
  return formatMonth(dateStr)
}

export function granularitySortValue(key: string, g: Granularity): number {
  if (g === "day") {
    const [dd, mm, yyyy] = key.split("/").map(Number)
    return new Date(yyyy, mm - 1, dd).getTime()
  }
  if (g === "year") return Number(key)
  const [m, y] = key.split(" ")
  return new Date(Number(y), MONTHS_SHORT.indexOf(m), 1).getTime()
}

export function today(): string {
  return new Date().toISOString().split("T")[0]
}
