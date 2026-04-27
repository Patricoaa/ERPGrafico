import * as z from "zod"

const accountIdSchema = z.union([z.string(), z.number()]).nullable()

export const billingSchema = z.object({
    default_receivable_account: accountIdSchema,
    default_payable_account: accountIdSchema,
    default_advance_payment_account: accountIdSchema,
    default_prepayment_account: accountIdSchema,
    allowed_dte_types_emit: z.array(z.string()),
    allowed_dte_types_receive: z.array(z.string()),
})

export type BillingFormValues = z.infer<typeof billingSchema>
