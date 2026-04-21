import * as z from "zod"

export const saleLineSchema = z.object({
    id: z.number().optional(),
    product: z.string().optional(),
    description: z.string().min(1, "La descripción es requerida"),
    quantity: z.number().min(0.01, "La cantidad debe ser mayor a 0"),
    uom: z.string().min(1, "Unidad requerida"),
    unit_price: z.number().min(0, "El precio no puede ser negativo"),
    unit_price_gross: z.number().min(0, "El precio no puede ser negativo").optional(),
    tax_rate: z.number().default(19),
    custom_specs: z.record(z.string(), z.unknown()).optional(),
    manufacturing_data: z.record(z.string(), z.unknown()).nullable().optional(),
})

export const saleOrderSchema = z.object({
    payment_method: z.enum(["CASH", "CARD", "TRANSFER", "CREDIT"]),
    notes: z.string().optional(),
    lines: z.array(saleLineSchema).min(1, "Debe agregar al menos una línea"),
})

export type SaleOrderFormValues = z.infer<typeof saleOrderSchema>
export type SaleLineFormValues = z.infer<typeof saleLineSchema>
