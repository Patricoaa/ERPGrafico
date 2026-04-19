import * as z from "zod"

export const serviceContractSchema = z.object({
    name: z.string().min(2, "El nombre es muy corto"),
    description: z.string().optional(),
    supplier: z.string().min(1, "Debe seleccionar proveedor"),
    category: z.string().min(1, "Debe seleccionar categoría"),
    recurrence_type: z.string().default("MONTHLY"),
    payment_day: z.coerce.number().min(1).max(31),
    base_amount: z.coerce.number().min(0),
    is_amount_variable: z.boolean().default(false),
    start_date: z.string().min(1, "Fecha de inicio requerida"),
    end_date: z.string().optional(),
    auto_renew: z.boolean().default(false),
    expense_account: z.string().optional(), // Will be populated from category
    payable_account: z.string().optional(), // Will be populated from category
})

export type ServiceContractFormValues = z.infer<typeof serviceContractSchema>
