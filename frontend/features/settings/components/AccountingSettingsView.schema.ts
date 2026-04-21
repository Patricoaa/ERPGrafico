import * as z from "zod"

export const accountingSchema = z.object({
    hierarchy_levels: z.number().min(2).max(5),
    code_separator: z.string().min(1).max(1),
    asset_prefix: z.string(),
    liability_prefix: z.string(),
    equity_prefix: z.string(),
    income_prefix: z.string(),
    expense_prefix: z.string(),
})

export const taxSchema = z.object({
    default_tax_rate: z.number().min(0).max(100),
    vat_payable_account: z.string().nullable(),
    vat_carryforward_account: z.string().nullable(),
    withholding_tax_account: z.string().nullable(),
    ppm_account: z.string().nullable(),
    second_category_tax_account: z.string().nullable(),
    correction_income_account: z.string().nullable(),
    default_tax_receivable_account: z.string().nullable(),
    default_tax_payable_account: z.string().nullable(),
})

export type AccountingFormValues = z.infer<typeof accountingSchema>
export type TaxFormValues = z.infer<typeof taxSchema>
