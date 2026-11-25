/** RCV periods: the SII publishes the registry by month from 2017 on. */
export const RCV_FIRST_YEAR = 2017

export const RCV_MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export const RCV_MONTH_OPTIONS = RCV_MONTH_NAMES.map((label, i) => ({ label, value: String(i + 1) }))

/** Years from the current one back to `RCV_FIRST_YEAR`. */
export function rcvYearOptions() {
    const current = new Date().getFullYear()
    return Array.from({ length: current - RCV_FIRST_YEAR + 1 }, (_, i) => {
        const year = String(current - i)
        return { label: year, value: year }
    })
}
