import * as z from "zod"

export const productSchema = z.object({
    code: z.string().optional().or(z.literal("")),
    internal_code: z.string().optional().or(z.literal("")),
    name: z.string().min(2, "Nombre requerido"),
    category: z.string().min(1, "Categoría requerida"),
    product_type: z.string().min(1, "Tipo requerido"),
    sale_price: z.preprocess((v) => Number(v) || 0, z.number().min(0, "Mínimo 0")),
    uom: z.string().min(1, "Unidad base requerida"),
    sale_uom: z.string().optional().or(z.literal("")),
    purchase_uom: z.string().optional().or(z.literal("")),
    allowed_sale_uoms: z.array(z.string()).default([]),
    receiving_warehouse: z.string().optional().or(z.literal("")),
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
    mfg_press_special: z.boolean().default(false),
    mfg_postpress_finishing: z.boolean().default(false),
    mfg_postpress_binding: z.boolean().default(false),
    mfg_default_delivery_days: z.preprocess((v) => Number(v) || 3, z.number().min(0)),
    // Recurrence
    recurrence_period: z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'WEEKLY']).optional(),
    renewal_notice_days: z.preprocess((v) => Number(v) || 30, z.number().min(0)).optional(),
    is_variable_amount: z.boolean().optional(),
    // Payment Configuration
    payment_day_type: z.enum(['INTERVAL', 'FIXED_DAY']).optional(),
    payment_day: z.preprocess((v) => Number(v) || undefined, z.number().min(1).max(31)).optional().nullable(),
    payment_interval_days: z.preprocess((v) => Number(v) || undefined, z.number().min(1)).optional().nullable(),
    // Invoice Configuration
    default_invoice_type: z.enum(['FACTURA', 'BOLETA']).optional(),
    // Direct Activation
    subscription_supplier: z.string().optional().or(z.literal("")).nullable(),
    subscription_amount: z.preprocess((v) => Number(v) || undefined, z.number().min(0)).optional().nullable(),
    subscription_start_date: z.string().optional().or(z.literal("")).nullable(),
    auto_activate_subscription: z.boolean().default(false),
    // Contract Duration
    is_indefinite: z.boolean().default(true),
    contract_end_date: z.string().optional().or(z.literal("")).nullable(),
    // Accounting
    income_account: z.string().optional().or(z.literal("")).nullable(),
    expense_account: z.string().optional().or(z.literal("")).nullable(),
    boms: z.array(z.object({
        id: z.number().optional(),
        name: z.string().min(1, "Nombre requerido"),
        active: z.boolean().default(false),
        lines: z.array(z.object({
            id: z.number().optional(),
            component: z.string().min(1, "Componente requerido"),
            quantity: z.preprocess((v) => Number(v) || 0, z.number().min(0.0001, "Mínimo 0.0001")),
            uom: z.string().optional(),
            notes: z.string().optional(),
        })).default([]),
    })).default([]),
    product_custom_fields: z.array(z.object({
        template: z.preprocess((v) => Number(v), z.number()),
        order: z.number().default(0)
    })).default([]),
}).refine((data) => {
    // Consumables cannot be sold
    if (data.product_type === 'CONSUMABLE' && data.can_be_sold) {
        return false;
    }
    return true;
}, {
    message: "Los productos consumibles no pueden ser marcados para la venta",
    path: ["can_be_sold"]
}).refine((data) => {
    // At least one purpose must be enabled
    return data.can_be_sold || data.can_be_purchased;
}, {
    message: "El producto debe poder ser vendido o comprado (al menos uno)",
    path: ["can_be_sold"]
}).refine((data) => {
    // If can_be_sold is true, sale_price must be > 0
    if (data.can_be_sold && (!data.sale_price || data.sale_price <= 0)) {
        return false;
    }
    return true;
}, {
    message: "El precio de venta debe ser mayor a 0",
    path: ["sale_price"]
}).refine((data) => {
    // If can_be_sold is true, sale_uom must be selected
    if (data.can_be_sold && (!data.sale_uom || data.sale_uom === "")) {
        return false;
    }
    return true;
}, {
    message: "Debe seleccionar una unidad de venta",
    path: ["sale_uom"]
}).refine((data) => {
    // If can_be_sold is true, at least 1 allowed_sale_uom must be selected
    if (data.can_be_sold && (!data.allowed_sale_uoms || data.allowed_sale_uoms.length === 0)) {
        return false;
    }
    return true;
}, {
    message: "Debe seleccionar al menos una unidad de venta permitida",
    path: ["allowed_sale_uoms"]
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
