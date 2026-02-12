import * as z from "zod"

export const productSchema = z.object({
    code: z.string().optional().or(z.literal("")),
    internal_code: z.string().optional().or(z.literal("")),
    name: z.string().min(2, "Nombre requerido"),
    category: z.string().min(1, "Categoría requerida"),
    product_type: z.string().min(1, "Tipo requerido"),
    is_dynamic_pricing: z.boolean().default(false),
    sale_price: z.preprocess((v) => Number(v) || 0, z.number().min(0, "Mínimo 0")),
    sale_price_gross: z.preprocess((v) => Number(v) || 0, z.number().min(0, "Mínimo 0")),
    uom: z.string().optional().or(z.literal("")),
    sale_uom: z.string().optional().or(z.literal("")),
    purchase_uom: z.string().optional().or(z.literal("")),
    allowed_sale_uoms: z.array(z.string()).default([]),
    receiving_warehouse: z.string().optional().or(z.literal("")),
    preferred_supplier: z.string().optional().or(z.literal("")).nullable(),
    image: z.any().optional(),
    track_inventory: z.boolean(),
    can_be_sold: z.boolean().default(true),
    can_be_purchased: z.boolean().default(true),
    custom_fields_schema: z.string().optional(),
    // Manufacturing fields
    has_bom: z.boolean().default(false),
    requires_advanced_manufacturing: z.boolean().default(false),
    has_variants: z.boolean().default(false),
    parent_template: z.string().optional().or(z.literal("")).nullable(),
    attribute_values: z.array(z.string()).default([]),
    variant_display_name: z.string().optional().or(z.literal("")),
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
    auto_activate_subscription: z.boolean().default(true),
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
    // If can_be_sold is true AND NOT dynamic pricing, sale_price must be > 0
    // Dynamic pricing allows sale_price to be 0 (set at POS)
    if (data.can_be_sold && !data.is_dynamic_pricing && (!data.sale_price || data.sale_price <= 0)) {
        return false;
    }
    return true;
}, {
    message: "El precio de venta debe ser mayor a 0",
    path: ["sale_price"]
}).refine((data) => {
    // UoM is required for inventory-tracked products (STORABLE, CONSUMABLE, MANUFACTURABLE)
    // and for SERVICE/SUBSCRIPTION when can_be_sold is true
    const requiresUom =
        ['STORABLE', 'CONSUMABLE', 'MANUFACTURABLE'].includes(data.product_type) ||
        (['SERVICE', 'SUBSCRIPTION'].includes(data.product_type) && data.can_be_sold);

    if (requiresUom && (!data.uom || data.uom === "")) {
        return false;
    }
    return true;
}, {
    message: "Unidad de Medida Stock requerida",
    path: ["uom"]
}).refine((data) => {
    // If can_be_sold is true, sale_uom must be selected
    // EXCEPTION: If has_variants is true, sale_uom might be defined per variant
    if (data.can_be_sold && !data.has_variants && (!data.sale_uom || data.sale_uom === "")) {
        return false;
    }
    return true;
}, {
    message: "Debe seleccionar una unidad de venta",
    path: ["sale_uom"]
}).refine((data) => {
    // If can_be_sold is true, at least 1 allowed_sale_uom must be selected
    // EXCEPTION: If has_variants is true, this might be handled per variant.
    // However, usually allowed UoMs are global? If the user request implies they are per variant or just hidden, we skip.
    // The user said: "Unidad de medida de venta deberia asignarse a cada variante".
    if (data.can_be_sold && !data.has_variants && (!data.allowed_sale_uoms || data.allowed_sale_uoms.length === 0)) {
        return false;
    }
    return true;
}, {
    message: "Debe seleccionar al menos una unidad de venta permitida",
    path: ["allowed_sale_uoms"]
}).refine((data) => {
    // If express production is enabled, at least one BOM must exist
    // EXCEPTION: If has_variants is true, BOMs are on the variants, not the parent
    if (data.mfg_auto_finalize && !data.has_variants && (!data.boms || data.boms.length === 0)) {
        return false;
    }
    return true;
}, {
    message: "Debe asignar al menos una lista de materiales para producción Express",
    path: ["boms"]
}).refine((data) => {
    // If express production is enabled, BOMs must have lines
    if (data.mfg_auto_finalize && !data.has_variants && data.boms && data.boms.some(bom => !bom.lines || bom.lines.length === 0)) {
        return false;
    }
    return true;
}, {
    message: "La lista de materiales debe tener al menos un componente",
    path: ["boms"]
}).refine((data) => {
    // SUBSCRIPTION: Supplier is mandatory because auto-activation is implicit/always active
    if (data.product_type === 'SUBSCRIPTION' && (!data.subscription_supplier || data.subscription_supplier === "")) {
        return false;
    }
    return true;
}, {
    message: "Debe seleccionar un proveedor para el producto de suscripción",
    path: ["subscription_supplier"]
}).refine((data) => {
    // SUBSCRIPTION: Amount is mandatory (even if variable, it serves as reference)
    if (data.product_type === 'SUBSCRIPTION' && (data.subscription_amount === undefined || data.subscription_amount === null)) {
        return false;
    }
    return true;
}, {
    message: "El monto de suscripción es obligatorio",
    path: ["subscription_amount"]
}).refine((data) => {
    // SUBSCRIPTION: Recurrence period is mandatory
    if (data.product_type === 'SUBSCRIPTION' && !data.recurrence_period) {
        return false;
    }
    return true;
}, {
    message: "La periodicidad es obligatoria",
    path: ["recurrence_period"]
}).refine((data) => {
    // SUBSCRIPTION: Start date is mandatory
    if (data.product_type === 'SUBSCRIPTION' && (!data.subscription_start_date || data.subscription_start_date === "")) {
        return false;
    }
    return true;
}, {
    message: "La fecha de inicio es obligatoria",
    path: ["subscription_start_date"]
}).refine((data) => {
    // SUBSCRIPTION: Payment timing config
    if (data.product_type === 'SUBSCRIPTION') {
        if (!data.payment_day_type) return false;
        if (data.payment_day_type === 'FIXED_DAY' && (data.payment_day === undefined || data.payment_day === null)) return false;
        if (data.payment_day_type === 'INTERVAL' && (data.payment_interval_days === undefined || data.payment_interval_days === null)) return false;
    }
    return true;
}, {
    message: "Debe seleccionar un tipo de fecha de pago",
    path: ["payment_day_type"]
}).refine((data) => {
    // SUBSCRIPTION: Payment day mandatory if FIXED_DAY
    if (data.product_type === 'SUBSCRIPTION' && data.payment_day_type === 'FIXED_DAY' && (data.payment_day === undefined || data.payment_day === null)) {
        return false;
    }
    return true;
}, {
    message: "El día del mes es obligatorio para fechas fijas",
    path: ["payment_day"]
}).refine((data) => {
    // SUBSCRIPTION: Interval days mandatory if INTERVAL
    if (data.product_type === 'SUBSCRIPTION' && data.payment_day_type === 'INTERVAL' && (data.payment_interval_days === undefined || data.payment_interval_days === null)) {
        return false;
    }
    return true;
}, {
    message: "El intervalo de días es obligatorio",
    path: ["payment_interval_days"]
}).refine((data) => {
    // SUBSCRIPTION: Default invoice type
    if (data.product_type === 'SUBSCRIPTION' && !data.default_invoice_type) {
        return false;
    }
    return true;
}, {
    message: "Debe seleccionar un tipo de documento por defecto",
    path: ["default_invoice_type"]
}).refine((data) => {
    // SUBSCRIPTION: Accounting mapping
    if (data.product_type === 'SUBSCRIPTION') {
        if (!data.income_account || data.income_account === "") return false;
        if (!data.expense_account || data.expense_account === "") return false;
    }
    return true;
}, {
    message: "El mapeo contable es obligatorio para suscripciones",
    path: ["income_account"]
})

export type ProductFormValues = z.infer<typeof productSchema>
