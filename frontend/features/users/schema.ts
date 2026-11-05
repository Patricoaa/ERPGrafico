import * as z from "zod"

export const userSchema = z.object({
    username: z.string().min(3, "Mínimo 3 caracteres"),
    roles: z.array(z.string()),
    teams: z.array(z.string()),
    contact: z.number().min(1, "Debe seleccionar un contacto"),
    password: z.string().optional(),
    is_active: z.boolean(),
    is_superuser: z.boolean(),
}).superRefine((data, ctx) => {
    if (!data.is_superuser && data.roles.length === 0) {
        ctx.addIssue({ code: "custom", path: ["roles"], message: "Debe seleccionar al menos un rol" })
    }
})

export type UserFormValues = z.infer<typeof userSchema>
