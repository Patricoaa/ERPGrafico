import * as z from "zod"
import { validateRUT } from "@/lib/utils/format"

const rutField = z.string().refine((value) => value.trim() === "" || validateRUT(value.trim()), "RUT inválido")

/** Configuración RCV / SII (autosave). La clave SII es de solo escritura y NO forma parte de este formulario. */
export const rcvSettingsSchema = z
    .object({
        company_rut: rutField,
        user_rut: rutField,
        enabled: z.boolean(),
        interval_days: z.number({ error: "Ingrese un número" }).int("Debe ser un número entero").min(1, "Entre 1 y 60").max(60, "Entre 1 y 60"),
        run_hour: z.number({ error: "Ingrese un número" }).int("Debe ser un número entero").min(0, "Entre 0 y 23").max(23, "Entre 0 y 23"),
        include_purchases: z.boolean(),
        include_sales: z.boolean(),
        /** Cuadre fiscal (ADR-0138): los documentos anteriores no se evalúan. */
        fiscal_match_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida").nullable(),
        terminal_match_window_minutes: z
            .number({ error: "Ingrese un número" })
            .int("Debe ser un número entero")
            .min(1, "Entre 1 y 240")
            .max(240, "Entre 1 y 240"),
    })
    .refine((v) => !v.enabled || v.include_purchases || v.include_sales, {
        message: "Selecciona compras, ventas o ambas",
        path: ["include_purchases"],
    })

export type RcvSettingsFormValues = z.infer<typeof rcvSettingsSchema>

/** Gate for autosave: first issue message when invalid, otherwise `true`. */
export function validateRcvSettings(values: RcvSettingsFormValues): true | string {
    const result = rcvSettingsSchema.safeParse(values)
    return result.success ? true : result.error.issues[0]?.message ?? "Revise los valores ingresados."
}
