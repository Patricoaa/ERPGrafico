import * as z from "zod"
import type { Account, AccountType, Product, ProductBOM, ProductCustomField } from "./entities"

// ─── Form Infrastructure ─────────────────────────────────

export type FormMode = 'create' | 'edit'

// ─── WorkOrder Form ──────────────────────────────────────

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
    sale_line?: string | number | { 
        id: string | number
        product?: { name: string }
        description?: string
        quantity?: number
        uom?: { name: string } 
    }
    product?: { 
        id: string | number
        name: string
        requires_bom_validation?: boolean
        uom?: { name: string }
        uom_category?: number
        track_inventory?: boolean
    }
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
        comments?: Array<{
            user: string
            text: string
            timestamp: string
        }>
    }
}

// ─── Payment Form ────────────────────────────────────────

export interface PaymentInitialData {
    id?: number
    payment_type?: 'INBOUND' | 'OUTBOUND'
    payment_method?: string
    treasury_account?: number | string
    treasury_account_id?: number | string
    amount?: number | string
    customer_id?: string
    supplier_id?: string
    invoice_id?: string
    reference?: string
    payment_method_new?: string | null
    contact?: string | number
    customer?: string | number
    supplier?: string | number
    transaction_number?: string
    invoice?: string | number
}

// ─── Product Form ────────────────────────────────────────

export interface ProductInitialData extends Partial<Omit<Product, 'boms' | 'product_custom_fields'>> {
    boms?: Array<{
        id?: number
        name: string
        active: boolean
        lines: Array<{
            id?: number
            component?: string | number
            quantity: number | string
            uom?: string | number
            notes?: string
        }>
    }>
    product_custom_fields?: Array<{ template: number; order: number }>
    // Subscription fields
    recurrence_period?: "MONTHLY" | "QUARTERLY" | "SEMIANNUAL" | "ANNUAL" | "WEEKLY"
    renewal_notice_days?: number
    is_variable_amount?: boolean
    payment_day_type?: string
    payment_day?: number
    payment_interval_days?: number
    default_invoice_type?: string
    subscription_supplier?: number | { id: number }
    subscription_amount?: number
    subscription_start_date?: string
    auto_activate_subscription?: boolean
    is_indefinite?: boolean
    contract_end_date?: string
    bom_cost?: number
    qty_reserved?: number
}

// ─── Journal Entry Form ──────────────────────────────────

export interface JournalEntryItem {
    id?: number
    account: string | number
    partner?: string
    label?: string
    debit: number | string
    credit: number | string
}

export interface JournalEntryInitialData {
    id?: number
    date: string | Date
    description: string
    reference?: string
    items: JournalEntryItem[]
}

// ─── Account Form ────────────────────────────────────────

export interface AccountInitialData {
    id?: number
    code?: string
    name?: string
    account_type?: AccountType
    parent?: string | number
    is_category?: string | null
    cf_category?: string | null
    bs_category?: string | null
    is_reconcilable?: boolean
}

// ─── Bank Journal Form ───────────────────────────────────

export interface BankJournalInitialData {
    id?: number
    name?: string
    code?: string
    currency?: string
    account?: number | string | { id: number }
}

// ─── Purchase Order Form ─────────────────────────────────

export interface PurchaseOrderLine {
    id?: number
    product?: string | number | { id: number }
    quantity: number | string
    uom?: string | number
    unit_cost: number | string
    tax_rate: number | string
}

export interface PurchaseOrderInitialData {
    id?: number
    notes?: string
    lines: PurchaseOrderLine[]
}

// ─── Category Form ───────────────────────────────────────

export interface CategoryInitialData {
    id?: number
    name?: string
    parent?: number | null | { id: number }
    image?: string | null
    product_type?: string
    description?: string
}

// ─── Warehouse Form ──────────────────────────────────────

export interface WarehouseInitialData {
    id?: number
    name?: string
    code?: string
    location?: string
    is_default_receiving?: boolean
    is_pos_warehouse?: boolean
}

// ─── Service Contract Form ───────────────────────────────

export interface ServiceContractInitialData {
    id?: number
    name?: string
    description?: string
    notes?: string
    supplier?: number
    category?: number
    recurrence_period?: string
    payment_day?: number
    amount?: string | number
    is_indefinite?: boolean
    start_date?: string
    end_date?: string | null
    auto_renew?: boolean
    expense_account?: number | null
    payable_account?: number | null
}

// ─── User Form ───────────────────────────────────────────

export interface UserInitialData {
    id?: number
    username?: string
    primary_role?: string
    functional_groups?: string[]
    groups?: string[]
    contact?: number
    password?: string
    is_active?: boolean
}

// ─── Pricing Rule Form ───────────────────────────────────

export interface PricingRuleInitialData {
    id?: number
    name?: string
    rule_type?: "FIXED" | "DISCOUNT_PERCENTAGE" | "PACKAGE_FIXED"
    operator?: "GT" | "LT" | "EQ" | "GE" | "LE" | "BT"
    product?: number | string | { id: number }
    category?: number | string | { id: number }
    min_quantity?: number | string
    max_quantity?: number | string | null
    discount_percentage?: number | string | null
    discount_type?: string
    discount_value?: number | string
    fixed_price?: number | string | null
    fixed_price_gross?: number | string | null
    start_date?: string | null
    end_date?: string | null
    active?: boolean
    is_active?: boolean
    priority?: number
    customer_group?: string
    min_order_amount?: number | string
    uom?: string | number
}

// ─── Group Form ──────────────────────────────────────────

export interface GroupInitialData {
    id?: number
    name?: string
    permissions?: number[]
}

// ─── Custom Field Template Form ──────────────────────────

export interface CustomFieldTemplateInitialData {
    id?: number
    name?: string
    field_type?: string
    description?: string
    is_required?: boolean
    default_value?: string
    options?: string[]
    applies_to?: string
}

// ─── Transaction Number Form ─────────────────────────────

export interface TransactionNumberInitialData {
    id?: number
    prefix?: string
    next_number?: number
    padding?: number
    transaction_type?: string
}
