import type { ReactNode } from "react"
import type { POSSessionMode } from "@/types/pos"

/** Etiqueta del modo de caja, la misma en barra superior, resúmenes y tarjetas. */
export const cashModeLabel = (mode: POSSessionMode | null | undefined) =>
    mode === "MULTI" ? "Multiusuario" : "Un solo usuario"

/** Fila de un resumen de confirmación (apertura / cierre): etiqueta a la izquierda, valor a la derecha. */
export function summaryRow(label: string, value: ReactNode, strong = false) {
    return (
        <div
            key={label}
            className={strong
                ? "flex items-baseline justify-between gap-4 py-3 text-2xl font-bold"
                : "flex items-baseline justify-between gap-4 py-3 text-lg"}
        >
            <span className={strong ? "text-foreground" : "text-muted-foreground"}>{label}</span>
            <span className="text-right font-medium">{value}</span>
        </div>
    )
}

// Clases literales: Tailwind solo genera las que ve escritas.
const ROW_COLUMNS = [
    "sm:grid-cols-1", "sm:grid-cols-1", "sm:grid-cols-2", "sm:grid-cols-3", "sm:grid-cols-4",
    "sm:grid-cols-5", "sm:grid-cols-6", "sm:grid-cols-7", "sm:grid-cols-8", "sm:grid-cols-9",
    "sm:grid-cols-10",
]

/**
 * Columnas de un grupo de tarjetas táctiles para que quepa sin scroll en un tótem: todas en una
 * fila (hasta 10); con más, dos filas parejas. Las tarjetas (`ChoiceCard size="touch"`) se achican
 * solas según su ancho. Bajo 640px se apilan.
 */
export function touchRow(count: number): string {
    const columns = count <= 10 ? count : Math.min(Math.ceil(count / 2), 10)
    return `grid-cols-1 ${ROW_COLUMNS[Math.max(columns, 1)]}`
}

/** Ancho máximo del paso según cuántas tarjetas lleva la fila (pocas no se estiran de borde a borde). */
export function touchRowWidth(count: number): string {
    if (count <= 1) return "max-w-md"
    if (count === 2) return "max-w-4xl"
    if (count === 3) return "max-w-6xl"
    return "max-w-none"
}

/** Separación entre tarjetas táctiles: más justa cuando la fila va llena. */
export const TOUCH_ROW_GAP = "gap-3 xl:gap-4"
