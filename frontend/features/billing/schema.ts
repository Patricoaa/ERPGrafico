import * as z from "zod"

/**
 * Factura por entregas / multi-orden (ADR-0081). `quantities` se indexa por
 * `${orderLineId}:${fulfillmentLineId | "none"}` → cantidad a facturar.
 */
export const invoiceFromLinesSchema = z.object({
    dteType: z.string().min(1, "Seleccione el tipo de documento"),
    post: z.boolean(),
    number: z.string(),
    date: z.string().min(1, "La fecha es requerida"),
    quantities: z.record(z.string(), z.number().min(0, "La cantidad no puede ser negativa")),
}).refine(
    (values) => Object.values(values.quantities).some((qty) => qty > 0),
    { message: "Indique al menos una cantidad a facturar", path: ["quantities"] },
)

export type InvoiceFromLinesFormValues = z.infer<typeof invoiceFromLinesSchema>

export const quantityKey = (orderLineId: number, fulfillmentLineId?: number | null) =>
    `${orderLineId}:${fulfillmentLineId ?? "none"}`
