import * as z from "zod"

export const productSchema = z.object({
    code: z.string().optional().or(z.literal("")),
    internal_code: z.string().optional().or(z.literal("")),
    name: z.string().min(2, "Nombre requerido"),
    category: z.string().min(1, "Categoría requerida"),
    product_type: z.string().min(1, "Tipo requerido"),
    sale_price: z.preprocess((v) => Number(v) || 0, z.number().min(0, "Mínimo 0")),
    uom: z.string().optional().or(z.literal("")),
    sale_uom: z.string().optional().or(z.literal("")),
    purchase_uom: z.string().optional().or(z.literal("")),
    allowed_sale_uoms: z.array(z.string()).default([]),
    image: z.any().optional(),
    track_inventory: z.boolean(),
    can_be_sold: z.boolean().default(true),
    can_be_purchased: z.boolean().default(true),
    custom_fields_schema: z.string().optional(),
    // Manufacturing fields
    has_bom: z.boolean().default(false),
    requires_advanced_manufacturing: z.boolean().default(false),
    mfg_auto_finalize: z.boolean().default(false),
    // Print Shop Workflow
    mfg_enable_prepress: z.boolean().default(false),
    mfg_enable_press: z.boolean().default(false),
    mfg_enable_postpress: z.boolean().default(false),
    mfg_prepress_design: z.boolean().default(false),
    mfg_prepress_specs: z.boolean().default(false),
    mfg_prepress_folio: z.boolean().default(false),
    mfg_press_offset: z.boolean().default(false),
    mfg_press_digital: z.boolean().default(false),
    mfg_postpress_finishing: z.boolean().default(false),
    mfg_postpress_binding: z.boolean().default(false),
    mfg_default_delivery_days: z.preprocess((v) => Number(v) || 3, z.number().min(0)),
    boms: z.array(z.object({
        id: z.number().optional(),
        name: z.string().min(1, "Nombre requerido"),
        active: z.boolean().default(false),
        lines: z.array(z.object({
            id: z.number().optional(),
            component: z.string().min(1, "Componente requerido"),
            quantity: z.preprocess((v) => Number(v) || 0, z.number().min(0.0001, "Mínimo 0.0001")),
            unit: z.string().default("UN"),
            notes: z.string().optional(),
        })).default([]),
    })).default([]),
    product_custom_fields: z.array(z.object({
        template: z.preprocess((v) => Number(v), z.number()),
        order: z.number().default(0)
    })).default([]),
}).refine((data) => {
    // If express production is enabled, at least one BOM must exist
    if (data.mfg_auto_finalize && (!data.boms || data.boms.length === 0)) {
        return false;
    }
    return true;
}, {
    message: "Debe asignar al menos una lista de materiales para producción Express",
    path: ["boms"]
}).refine((data) => {
    // If express production is enabled, BOMs must have lines
    if (data.mfg_auto_finalize && data.boms && data.boms.some(bom => !bom.lines || bom.lines.length === 0)) {
        return false;
    }
    return true;
}, {
    message: "La lista de materiales debe tener al menos un componente",
    path: ["boms"]
})

export type ProductFormValues = z.infer<typeof productSchema>
