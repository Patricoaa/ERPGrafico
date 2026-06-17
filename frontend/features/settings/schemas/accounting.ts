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

export const defaultsSchema = z.object({
    default_receivable_account: z.string().nullable(),
    default_payable_account: z.string().nullable(),
    default_revenue_account: z.string().nullable(),
    default_expense_account: z.string().nullable(),
    merchandise_cogs_account: z.string().nullable(),
    manufactured_cogs_account: z.string().nullable(),
    adjustment_income_account: z.string().nullable(),
    adjustment_expense_account: z.string().nullable(),
})

export const taxSchema = z.object({
    default_vat_rate: z.number().min(0).max(100),
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

export type AccountingFormValues = z.infer<typeof accountingSchema>
export type DefaultsFormValues = z.infer<typeof defaultsSchema>
export type TaxFormValues = z.infer<typeof taxSchema>
