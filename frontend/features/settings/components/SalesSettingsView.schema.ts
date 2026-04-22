import * as z from "zod"

export const salesSchema = z.object({
    default_revenue_account: z.string().nullable(),
    default_service_revenue_account: z.string().nullable(),
    default_subscription_revenue_account: z.string().nullable(),
    pos_default_credit_percentage: z.number(),
    pos_enable_line_discounts: z.boolean(),
    pos_enable_total_discounts: z.boolean(),
    pos_line_discount_user: z.number().nullable(),
    pos_line_discount_group: z.string(),
    pos_global_discount_user: z.number().nullable(),
    pos_global_discount_group: z.string(),
    terminal_commission_bridge_account: z.string().nullable(),
    terminal_iva_bridge_account: z.string().nullable(),
    credit_auto_block_days: z.number().nullable(),
    default_uncollectible_expense_account: z.string().nullable(),
})

export type SalesFormValues = z.infer<typeof salesSchema>
