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

export const pinSchema = z.object({
    current_password: z.string().min(1, "Ingrese su contraseña actual"),
    new_pin: z.string()
        .min(1, "El PIN no puede estar vacío")
        .max(4, "Máximo 4 dígitos")
        .regex(/^\d+$/, "El PIN debe ser solo números"),
    confirm_pin: z.string().min(1, "Confirme el nuevo PIN"),
}).refine(data => data.new_pin === data.confirm_pin, {
    message: "Los PINs no coinciden",
    path: ["confirm_pin"],
})

export type PinFormValues = z.infer<typeof pinSchema>
