import * as z from "zod"

const accountIdSchema = z.union([z.string(), z.number()]).nullable()

export const billingSchema = z.object({
    default_vat_rate: z.number().min(0).max(100),
    vat_payable_account: accountIdSchema,
    vat_carryforward_account: accountIdSchema,
    withholding_tax_account: accountIdSchema,
    ppm_account: accountIdSchema,
    second_category_tax_account: accountIdSchema,
    correction_income_account: accountIdSchema,
    default_tax_receivable_account: accountIdSchema,
    default_tax_payable_account: accountIdSchema,
    loan_retention_account: accountIdSchema,
    ila_tax_account: accountIdSchema,
    vat_withholding_account: accountIdSchema,
    default_receivable_account: accountIdSchema,
    default_payable_account: accountIdSchema,
    default_advance_payment_account: accountIdSchema,
    default_prepayment_account: accountIdSchema,
    allowed_dte_types_emit: z.array(z.string()),
    allowed_dte_types_receive: z.array(z.string()),
})

export type BillingFormValues = z.infer<typeof billingSchema>
