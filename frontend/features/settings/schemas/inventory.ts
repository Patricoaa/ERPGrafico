import * as z from "zod"

export const inventoryAccountsSchema = z.object({
    storable_inventory_account: z.string().nullable(),
    manufacturable_inventory_account: z.string().nullable(),
    default_consumable_account: z.string().nullable(),
    stock_input_account: z.string().nullable(),
    stock_output_account: z.string().nullable(),
    adjustment_income_account: z.string().nullable(),
    adjustment_expense_account: z.string().nullable(),
    revaluation_account: z.string().nullable(),
    merchandise_cogs_account: z.string().nullable(),
    manufactured_cogs_account: z.string().nullable(),
})

export type InventoryAccountsFormValues = z.infer<typeof inventoryAccountsSchema>
