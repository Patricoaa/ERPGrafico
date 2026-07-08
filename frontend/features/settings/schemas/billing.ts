import * as z from "zod"

export const billingAccountsSchema = z.object({
    default_receivable_account: z.string().nullable(),
    default_payable_account: z.string().nullable(),
    default_advance_payment_account: z.string().nullable(),
    default_prepayment_account: z.string().nullable(),
})

export type BillingAccountsFormValues = z.infer<typeof billingAccountsSchema>
