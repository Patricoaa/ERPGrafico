import * as z from "zod"

export const salesSchema = z.object({
    pos_default_credit_percentage: z.number(),
    pos_enable_line_discounts: z.boolean(),
    pos_enable_total_discounts: z.boolean(),
    pos_line_discount_user: z.number().nullable(),
    pos_line_discount_group: z.string(),
    pos_global_discount_user: z.number().nullable(),
    pos_global_discount_group: z.string(),
    credit_auto_block_days: z.number().nullable(),
})

export type SalesFormValues = z.infer<typeof salesSchema>
