/** Local-date ISO (yyyy-mm-dd), clamped to the last day of the target month (no overflow). */
export function monthsAgoIso(months: number, today = new Date()): string {
    const target = new Date(today.getFullYear(), today.getMonth() - months, 1)
    const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
    target.setDate(Math.min(today.getDate(), lastDay))
    const pad = (n: number) => String(n).padStart(2, "0")
    return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`
}
