import * as z from "zod"

/** API key de SimpleAPI. `key` es de solo escritura: obligatoria al crear, vacía al editar la conserva. */
export const rcvApiKeySchema = z.object({
    label: z.string().trim().max(60, "Máximo 60 caracteres").optional(),
    key: z.string().optional(),
    is_active: z.boolean(),
    monthly_limit: z.number({ error: "Ingrese un número" }).int("Debe ser un número entero").min(1, "Entre 1 y 1000").max(1000, "Entre 1 y 1000"),
})

export type RcvApiKeyFormValues = z.infer<typeof rcvApiKeySchema>

/** Mensaje de error si falta la key al crear; `null` si es válido. */
export function missingRcvKeyMessage(values: RcvApiKeyFormValues, isEditing: boolean): string | null {
    return !isEditing && !values.key?.trim() ? "La API key es obligatoria" : null
}
