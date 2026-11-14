import * as z from "zod"

export const providerSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    provider_type: z.string().min(1, "El tipo es requerido"),
    supplier: z.string().nullable().optional(),
    receivable_account: z.string().nullable().optional(),
    commission_expense_account: z.string().nullable().optional(),
    commission_iva_account: z.string().nullable().optional(),
    commission_product: z.string().nullable().optional(),
    default_deposit_account: z.string().nullable().optional(),
    /** Write-only TUU API key. Empty/omitted keeps the stored one. */
    api_key: z.string().optional(),
})

export type ProviderFormValues = z.infer<typeof providerSchema>
