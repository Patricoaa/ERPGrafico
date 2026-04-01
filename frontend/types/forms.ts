import * as z from "zod"

export const workOrderSchema = z.object({
    description: z.string().min(1, "La descripción es requerida"),
    sale_order: z.string().optional().or(z.literal("")),
    start_date: z.date().optional().nullable(),
    due_date: z.date().optional().nullable(),
    product_description: z.string().optional(),
    internal_notes: z.string().optional(),
    contact_id: z.string().optional().or(z.literal("")),
    sale_line: z.string().optional().or(z.literal("")),
    product_id: z.string().optional().or(z.literal("")),
    quantity: z.string().optional(),
    uom_id: z.string().optional().or(z.literal("")),
}).superRefine((data, ctx) => {
    if (data.product_id && !data.uom_id) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "La unidad de medida es requerida para producción manual",
            path: ["uom_id"],
        })
    }
})

export type WorkOrderFormValues = z.infer<typeof workOrderSchema>

export interface WorkOrderInitialData {
    id?: number | string
    number?: string | number
    description?: string
    sale_order?: string | number | { id: string | number }
    start_date?: string | Date
    estimated_completion_date?: string | Date
    sale_order_delivery_date?: string | Date
    sale_line?: string | number | { id: string | number, product?: any, description?: string, quantity?: number, uom?: any }
    product?: { id: string | number, name: string, requires_bom_validation?: boolean }
    status?: string
    current_stage?: string
    production_progress?: number
    sale_order_number?: string | number
    
    stage_data?: {
        product_description?: string
        internal_notes?: string
        contact_id?: string | number
        contact_name?: string
        contact_tax_id?: string
        phases?: {
            prepress?: boolean
            press?: boolean
            postpress?: boolean
        }
        prepress_specs?: string
        press_specs?: string
        postpress_specs?: string
        design_needed?: boolean
        folio_enabled?: boolean
        folio_start?: string
        print_type?: string
        design_attachments?: string[]
        quantity?: number | string
        uom_id?: string | number
        uom_name?: string
    }
}
