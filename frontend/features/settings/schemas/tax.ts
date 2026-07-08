import * as z from "zod"

export const taxSchema = z.object({
    vat_payable_account: z.string().nullable(),
    vat_carryforward_account: z.string().nullable(),
    withholding_tax_account: z.string().nullable(),
    ppm_account: z.string().nullable(),
    second_category_tax_account: z.string().nullable(),
    correction_income_account: z.string().nullable(),
    default_tax_receivable_account: z.string().nullable(),
    default_tax_payable_account: z.string().nullable(),
    loan_retention_account: z.string().nullable(),
    ila_tax_account: z.string().nullable(),
    vat_withholding_account: z.string().nullable(),
})

export type TaxFormValues = z.infer<typeof taxSchema>
