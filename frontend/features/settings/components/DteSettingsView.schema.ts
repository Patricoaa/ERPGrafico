import * as z from "zod"

export const DTE_TYPE_IDS = [
    "FACTURA",
    "FACTURA_EXENTA",
    "BOLETA",
    "BOLETA_EXENTA",
] as const

export const DTE_TYPE_OPTIONS = [
    { id: "FACTURA", label: "Factura Electrónica", code: "33" },
    { id: "FACTURA_EXENTA", label: "Factura Exenta", code: "34" },
    { id: "BOLETA", label: "Boleta Electrónica", code: "39" },
    { id: "BOLETA_EXENTA", label: "Boleta Exenta", code: "41" },
] as const

export type ConfigurableDteType = typeof DTE_TYPE_IDS[number]

/**
 * Configuración DTE de un solo lado (ADR-0089): cada módulo edita la lista de tipos
 * permitidos de su flujo (emitir en Ventas, recibir en Compras) y se guarda con
 * PATCH parcial al mismo endpoint de `AccountingSettings`.
 */
export const dteSideSchema = z.object({
    allowed_dte_types: z.array(z.enum(DTE_TYPE_IDS)).min(1, "Mantenga al menos un tipo de documento habilitado."),
})

export type DteSideFormValues = z.infer<typeof dteSideSchema>
