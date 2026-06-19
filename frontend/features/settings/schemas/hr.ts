import * as z from "zod"

export const hrSchema = z.object({
    account_remuneraciones_por_pagar: z.string().nullable(),
    account_previred_por_pagar: z.string().nullable(),
    account_anticipos: z.string().nullable(),
})

export type HRSettingsFormValues = z.infer<typeof hrSchema>
