import * as z from "zod"

/** Facturación parcial / multi-orden por cantidad (ADR-0081). Respuesta de /billing/invoices/invoiceable-lines/. */
const decimal = z.union([z.string(), z.number()]).transform((v) => Number(v))

export const invoiceableFulfillmentSchema = z.object({
    id: z.number(),
    document_id: z.number(),
    document_display: z.string(),
    date: z.string().nullable(),
    delivered: decimal,
    invoiced: decimal,
    pending: decimal,
})

export const invoiceableLineSchema = z.object({
    id: z.number(),
    product_id: z.number().nullable(),
    description: z.string(),
    quantity: decimal,
    quantity_invoiced: decimal,
    pending: decimal,
    deliverable: z.boolean(),
    fulfillments: z.array(invoiceableFulfillmentSchema),
})

export const invoiceableOrderSchema = z.object({
    order_id: z.number(),
    display_id: z.string(),
    partner_id: z.number().nullable(),
    invoicing_status: z.string(),
    lines: z.array(invoiceableLineSchema),
})

export type InvoiceableFulfillment = z.infer<typeof invoiceableFulfillmentSchema>
export type InvoiceableLine = z.infer<typeof invoiceableLineSchema>
export type InvoiceableOrder = z.infer<typeof invoiceableOrderSchema>

export type InvoiceSide = "sale" | "purchase"

export interface InvoiceableLinesParams {
    side: InvoiceSide
    partner?: number | null
    orders?: number[]
}

export interface InvoiceFromLinesPayload {
    side: InvoiceSide
    dte_type: string
    status: "DRAFT" | "POSTED"
    number?: string
    date?: string
    items: Array<{ order_line_id: number; quantity: number; fulfillment_line_id?: number | null }>
}
