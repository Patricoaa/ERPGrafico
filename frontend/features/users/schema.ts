import * as z from "zod"

export const userSchema = z.object({
    username: z.string().min(3, "Mínimo 3 caracteres"),
    roles: z.array(z.string()).min(1, "Debe seleccionar al menos un puesto"),
    teams: z.array(z.string()),
    contact: z.number().min(1, "Debe seleccionar un contacto"),
    password: z.string().optional(),
    is_active: z.boolean(),
})

export type UserFormValues = z.infer<typeof userSchema>
