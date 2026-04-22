import * as z from "zod"

export const serviceContractSchema = z.object({
    name: z.string().min(1, "El nombre es requerido"),
    description: z.string(),
    supplier: z.string(),
    category: z.string(),
    recurrence_type: z.string(),
    payment_day: z.coerce.number().min(1).max(31),
    base_amount: z.coerce.number().min(0),
    is_amount_variable: z.boolean(),
    start_date: z.string().min(1, "Fecha de inicio requerida"),
    end_date: z.string().nullable(),
    auto_renew: z.boolean(),
    expense_account: z.string(),
    payable_account: z.string(),
})

export type ServiceContractFormValues = z.infer<typeof serviceContractSchema>
