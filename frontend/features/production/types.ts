import { LucideIcon } from "lucide-react"

export interface WorkOrderMaterial {
    id: number
    component: number
    component_name: string
    component_code?: string
    quantity_planned: number
    quantity_consumed?: number
    uom: number
    uom_name: string
    uom_category?: number
    total_cost: number
    source: "MANUAL" | "BOM"
    is_outsourced: boolean
    is_available?: boolean
    supplier?: number
    supplier_name?: string
    unit_price?: string
    purchase_order_number?: string
    document_type?: string
}

export interface ProductionAttachment {
    id: number
    original_filename: string
    file: string
    uploaded_at: string
    uploaded_by_name?: string
}

export interface WorkOrderTask {
    id: string
    task_type: string
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
    assigned_to?: number
    assigned_group?: string
    assigned_group_name?: string
    data?: Record<string, unknown>
}

export interface WorkOrderStage {
    id: string
    label: string
    icon: LucideIcon
    alwaysShow: boolean
}

export interface ProductionComment {
    id: string | number
    user: string
    text: string
    timestamp: string
}

export interface WorkOrder {
    id: number
    display_id: string
    number?: string
    main_product_id: number
    product_name: string
    status: string
    current_stage: string
    requires_prepress: boolean
    requires_press: boolean
    requires_postpress: boolean
    is_manual: boolean
    description?: string
    sale_customer_name?: string
    sale_order_date?: string
    due_date?: string
    outsourcing_status?: "none" | "partial" | "full"
    warehouse_name?: string
    materials?: WorkOrderMaterial[]
    workflow_tasks?: WorkOrderTask[]
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
        comments?: ProductionComment[]
    }
    product?: {
        id: string | number
        name: string
        track_inventory: boolean
        requires_bom_validation?: boolean
        uom?: {
            name: string
        }
    }
    sale_line?: {
        id: number
        product?: {
            name: string
        }
        description?: string
        quantity?: number
        uom?: {
            name: string
        }
    }
    sale_order?: {
        id: number
        number: string
    }
    total_price?: number
    created_at?: string
    sale_customer_rut?: string
    is_cancellable?: boolean
    checkout_files?: ProductionAttachment[]
    attachments?: ProductionAttachment[]
}

export interface BOMLine {
    id?: number
    component: string | number
    component_name?: string
    component_code?: string
    component_cost?: number
    quantity: number
    uom?: string | number
    uom_name?: string
    uom_category?: number
    is_outsourced: boolean
    supplier?: string | number
    supplier_name?: string
    unit_price?: string
    notes?: string
}

export interface BOM {
    id?: number
    product: number
    name: string
    active: boolean
    yield_quantity: number
    yield_uom?: number
    lines: BOMLine[]
}

export interface UoM {
    id: number
    name: string
    category: number
    ratio: number
    uom_type?: string
}

export interface ProductMinimal {
    id: number | string
    name: string
    code?: string
    internal_code?: string
    variant_display_name?: string
    product_type?: string
    uom?: UoM | number | string
    uom_name?: string
    uom_category?: number
    cost_price?: number | string
    has_variants?: boolean
    track_inventory?: boolean
    requires_bom_validation?: boolean
    requires_advanced_manufacturing?: boolean
    mfg_auto_finalize?: boolean
    attribute_values_data?: {
        id: number
        attribute: string
        value: string
    }[]
}

export interface ProductVariantMinimal extends ProductMinimal {
    parent_template?: number | string
    technical_description?: string
}
