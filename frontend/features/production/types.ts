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

export interface WorkOrderTask {
    id: string
    task_type: string
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
    assigned_to?: number
    assigned_group?: string
    assigned_group_name?: string
    data?: any
}

export interface WorkOrderStage {
    id: string
    label: string
    icon: LucideIcon
    alwaysShow: boolean
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
    warehouse_name?: string
    materials?: WorkOrderMaterial[]
    workflow_tasks?: WorkOrderTask[]
    stage_data?: any
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
    }
    sale_order?: {
        id: number
        number: string
    }
    checkout_files?: any[]
    attachments?: any[]
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

export interface ProductMinimal {
    id: number | string
    name: string
    code?: string
    uom?: {
        id: number
        name: string
    }
    has_variants?: boolean
    track_inventory?: boolean
}

export interface ProductVariantMinimal extends ProductMinimal {
    parent_template?: number | string
    technical_description?: string
}

export interface UoM {
    id: number
    name: string
    category?: number
}
