export const DEBUG_CLOCK_TIMEZONE = "America/Santiago"

/** Formatea un instante ISO como `dd-mm-aaaa HH:mm` en la zona del servidor. */
export function formatDebugClock(iso: string, timeZone: string = DEBUG_CLOCK_TIMEZONE): string {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return iso
    // La zona del servidor es explícita (no la del navegador), por eso no se usa formatDate().
    // eslint-disable-next-line dates/no-adhoc-date-format
    const parts = new Intl.DateTimeFormat("es-CL", {
        timeZone,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).formatToParts(date)
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? ""
    return `${get("day")}-${get("month")}-${get("year")} ${get("hour")}:${get("minute")}`
}
