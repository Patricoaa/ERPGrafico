import * as z from "zod"
import type { RcvDirection, StartRcvImportPayload } from "../../types"

export const RCV_FIRST_IMPORT_YEAR = 2017
const DAY_MS = 24 * 60 * 60 * 1000

/** Mes/año de (hoy − 3 días), igual que el período automático del backend. */
export function defaultRcvImportPeriod(now: Date = new Date()): { year: number; month: number } {
    const d = new Date(now.getTime() - 3 * DAY_MS)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

export const rcvImportSchema = z
    .object({
        year: z.number().int().min(RCV_FIRST_IMPORT_YEAR, "Año inválido"),
        month: z.number().int().min(1, "Mes inválido").max(12, "Mes inválido"),
        directions: z.array(z.enum(["PURCHASES", "SALES"])).min(1, "Selecciona al menos una dirección"),
    })
    .superRefine((values, ctx) => {
        const now = new Date()
        const currentYear = now.getFullYear()
        if (values.year > currentYear) {
            ctx.addIssue({ code: "custom", path: ["year"], message: "No se puede importar un período futuro" })
        } else if (values.year === currentYear && values.month > now.getMonth() + 1) {
            ctx.addIssue({ code: "custom", path: ["month"], message: "No se puede importar un período futuro" })
        }
    })

export type RcvImportFormValues = z.infer<typeof rcvImportSchema>

const ALL_DIRECTIONS: RcvDirection[] = ["PURCHASES", "SALES"]

/** Período por defecto y las direcciones indicadas (ambas si no se indica ninguna). */
export function defaultRcvImportValues(now: Date = new Date(), directions: readonly RcvDirection[] = ALL_DIRECTIONS): RcvImportFormValues {
    return { ...defaultRcvImportPeriod(now), directions: [...directions] }
}

export function toStartRcvImportPayload(values: RcvImportFormValues): StartRcvImportPayload {
    return { year: values.year, month: values.month, directions: values.directions }
}
