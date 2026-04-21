import * as z from "zod"

export const globalSettingsSchema = z.object({
    uf_current_value: z.string(),
    utm_current_value: z.string(),
    min_wage_value: z.string(),
    account_remuneraciones_por_pagar: z.string().nullable(),
    account_previred_por_pagar: z.string().nullable(),
    account_anticipos: z.string().nullable(),
})

export const conceptSchema = z.object({
    name: z.string().min(1, "Nombre requerido"),
    category: z.enum(['HABER_IMPONIBLE', 'HABER_NO_IMPONIBLE', 'DESCUENTO_LEGAL_TRABAJADOR', 'DESCUENTO_LEGAL_EMPLEADOR', 'OTRO_DESCUENTO']),
    account: z.string().min(1, "Cuenta requerida"),
    formula_type: z.enum(['FIXED', 'PERCENTAGE', 'EMPLOYEE_SPECIFIC', 'FORMULA', 'CHILEAN_LAW']),
    formula: z.string().optional(),
    default_amount: z.string(),
})

export const afpSchema = z.object({
    name: z.string().min(1, "Nombre requerido"),
    percentage: z.string().min(1, "Porcentaje requerido"),
    account: z.string().nullable(),
})

export type GlobalHRFormValues = z.infer<typeof globalSettingsSchema>
export type ConceptFormValues = z.infer<typeof conceptSchema>
export type AFPFormValues = z.infer<typeof afpSchema>
