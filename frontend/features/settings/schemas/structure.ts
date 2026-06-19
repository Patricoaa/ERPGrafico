import * as z from "zod"

export const structureSchema = z.object({
    hierarchy_levels: z.number().min(2).max(5),
    code_separator: z.string().min(1).max(1),
    asset_prefix: z.string(),
    liability_prefix: z.string(),
    equity_prefix: z.string(),
    income_prefix: z.string(),
    expense_prefix: z.string(),
})

export type StructureFormValues = z.infer<typeof structureSchema>
