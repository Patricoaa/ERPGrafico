import { z } from "zod"

const positiveAmount = z
    .string()
    .min(1, "Monto requerido")
    .refine(v => parseFloat(v) > 0, "El monto debe ser mayor a 0")

const common = {
    employee: z.string().min(1, "Empleado requerido"),
    date: z.string().min(1, "Fecha requerida"),
    amount: positiveAmount,
    notes: z.string().optional(),
}

const advanceSchema = z.object({ ...common, kind: z.literal("ADVANCE") })

const positiveInt = (label: string) =>
    z.string().min(1, `${label} requerido`).refine(v => Number.isInteger(Number(v)) && Number(v) > 0, `${label} inválido`)

/** `rate` se captura en porcentaje (1 = 1 %) y se convierte a decimal al enviar. */
const loanSchema = z.object({
    ...common,
    kind: z.literal("LOAN"),
    rate: z.string().min(1, "Tasa requerida").refine(v => parseFloat(v) >= 0, "La tasa no puede ser negativa"),
    rate_period: z.enum(["MONTHLY", "ANNUAL"]),
    installments_count: positiveInt("Cuotas"),
    first_installment_year: positiveInt("Año"),
    first_installment_month: positiveInt("Mes").refine(v => Number(v) <= 12, "Mes inválido"),
})

export const employeeMovementFormSchema = z.discriminatedUnion("kind", [advanceSchema, loanSchema])

export type EmployeeMovementFormValues = z.infer<typeof employeeMovementFormSchema>
