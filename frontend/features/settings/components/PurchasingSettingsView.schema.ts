import * as z from "zod"

export const purchasingSchema = z.object({
    default_expense_account: z.string().nullable(),
    default_service_expense_account: z.string().nullable(),
    default_subscription_expense_account: z.string().nullable(),
})

export type PurchasingFormValues = z.infer<typeof purchasingSchema>
