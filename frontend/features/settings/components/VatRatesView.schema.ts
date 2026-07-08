import * as z from "zod"

export const vatRatesSchema = z.object({
    default_vat_rate: z.number().min(0).max(100),
})

export type VatRatesFormValues = z.infer<typeof vatRatesSchema>
