import * as z from "zod"

/** Hora local del servidor (America/Santiago) en formato de `datetime-local`. */
export const debugClockSchema = z.object({
    datetime: z
        .string()
        .min(1, "Ingrese fecha y hora")
        .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Formato AAAA-MM-DDTHH:MM"),
})

export type DebugClockFormValues = z.infer<typeof debugClockSchema>
