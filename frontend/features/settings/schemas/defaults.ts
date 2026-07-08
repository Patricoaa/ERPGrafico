import * as z from "zod"

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

export type DefaultsFormValues = z.infer<typeof defaultsSchema>
