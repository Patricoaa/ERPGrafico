import * as z from "zod"

export const passwordSchema = z.object({
    current_password: z.string().min(1, "Ingrese su contraseña actual"),
    new_password: z.string().min(6, "Mínimo 6 caracteres"),
    confirm_password: z.string().min(1, "Confirme la nueva contraseña"),
}).refine(data => data.new_password === data.confirm_password, {
    message: "Las contraseñas no coinciden",
    path: ["confirm_password"],
})

export type PasswordFormValues = z.infer<typeof passwordSchema>
