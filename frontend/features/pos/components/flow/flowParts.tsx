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
