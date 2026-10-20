import * as z from "zod"

/**
 * Configuración DTE de un solo lado (ADR-0089): cada módulo edita la lista de tipos
 * permitidos de su flujo (emitir en Ventas, recibir en Compras) y se guarda con
 * PATCH parcial al mismo endpoint de `AccountingSettings`.
 */export const dteSideSchema = z.object({
    allowed_dte_types: z.array(z.string()),
})

export type DteSideFormValues = z.infer<typeof dteSideSchema>
