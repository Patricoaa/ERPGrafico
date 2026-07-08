import * as z from "zod"

export const salesAccountsSchema = z.object({
    default_revenue_account: z.string().nullable(),
    default_service_revenue_account: z.string().nullable(),
    default_subscription_revenue_account: z.string().nullable(),
    default_uncollectible_expense_account: z.string().nullable(),
})

export type SalesAccountsFormValues = z.infer<typeof salesAccountsSchema>
