import * as z from "zod"

export const serviceContractSchema = z.object({
    name: z.string().min(1, "Nombre requerido"),
    description: z.string().optional().default(""),
    supplier: z.string().min(1, "Proveedor requerido"),
    category: z.string().min(1, "Categoría requerida"),
    recurrence_type: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL", "ONE_TIME"]),
    payment_day: z.number().int().min(1).max(31),
    base_amount: z.number().nonnegative(),
    is_amount_variable: z.boolean(),
    start_date: z.string().min(1, "Fecha inicio requerida"),
    end_date: z.string().nullable().optional().default(null),
    auto_renew: z.boolean(),
    expense_account: z.string(),
    payable_account: z.string(),
})

export type ServiceContractFormValues = z.infer<typeof serviceContractSchema>
