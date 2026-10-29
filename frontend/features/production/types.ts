import { type LucideIcon } from "lucide-react"
import type { WorkOrderStageData } from './schemas'
import type { StageId } from './constants/stages'
export type { StageId }

import type { WorkOrderInitialData } from '@/types/forms'
import type { TaskAttachment } from '@/features/workflow'

export type WizardMode =
    | { kind: 'create'; defaultOtType?: 'LINKED' | 'NONE'; defaultProductId?: string; initialData?: WorkOrderInitialData }
    | { kind: 'manage'; orderId: number; targetStage?: StageId | 'BASIC_INFO' }

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
    planned_cost?: number
    actual_cost?: number
    source: "MANUAL" | "BOM"
    is_outsourced: boolean
    is_available?: boolean
    stock_available?: number
    supplier?: number
    supplier_name?: string
    unit_price?: string
    purchase_order_number?: string
    purchase_order_id?: number
    purchase_order_receiving_status?: string
    document_type?: string
}

export interface ProductionAttachment {
    id: number
    original_filename: string
    file: string
    file_size?: string | number
    uploaded_at: string
    uploaded_by_name?: string
}

export interface WorkOrderTaskEvent {
    id: number
    action: "COMPLETED" | "REOPENED" | string
    user_name: string | null
    notes: string
    confirmations?: Record<string, boolean>
    attachments_data: TaskAttachment[]
    created_at: string
}

export interface WorkOrderTask {
    id: string | number
    task_type: string
    status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"
    assigned_to?: number
    assigned_group?: string
    assigned_group_name?: string
    assigned_to_data?: { username: string } | null
    data?: Record<string, unknown>
    title?: string
    description?: string
    priority?: string
    created_by?: string
    created_at?: string
    /** Serialized requirements: key → human-readable message.  Key "evidence" means a file attachment is required. */
    requirements?: Record<string, string>
    /** Past completion/reopening events for this task. */
    events_data?: WorkOrderTaskEvent[]
    /** User who last completed this task. */
    completed_by_data?: { username: string } | null
    attachments_data?: TaskAttachment[]
}

/** One entry of `WorkOrder.stage_history` (WorkOrderHistorySerializer). */
export interface WorkOrderHistoryEntry {
    id: number
    stage: string
    /** WorkOrderHistory.Event: ENTERED | REOPENED | EDITED | NOTE */
    event?: string
    /** WorkOrder.Status at the time of the entry (DRAFT | IN_PROGRESS | …) */
    status: string
    notes?: string
    user?: number | null
    user_name?: string | null
    created_at: string
    work_order?: number
}

export interface WorkOrderStage {
    id: string
    label: string
    icon: LucideIcon
    alwaysShow: boolean
    isCreationStep?: boolean
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
    product_description?: string
    prepress_archive?: string
    start_date?: string
    sale_order_delivery_date?: string
    sale_customer_name?: string
    sale_customer_rut?: string
    sale_order_date?: string
    sale_order_number?: string | null
    sale_order_document?: unknown | null
    // Unified accessors from serializer (works for both LINKED and MANUAL).
    quantity?: number | null
    uom_id?: number | null
    uom_name?: string | null
    actual_quantity_produced?: number | null
    due_date?: string
    outsourcing_status?: "none" | "partial" | "full"
    warehouse_name?: string
    materials?: WorkOrderMaterial[]
    workflow_tasks?: WorkOrderTask[]
    stage_history?: WorkOrderHistoryEntry[]
    stage_data?: WorkOrderStageData
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
    is_cancellable?: boolean
    has_consumptions?: boolean
    checkout_files?: ProductionAttachment[]
    attachments?: ProductionAttachment[]
    production_discrepancy?: {
        produced: number
        sold: number
        delta: number
    } | null
    side_effects?: WorkOrderSideEffects
    /** Stages of this OT in order, as the server's stage graph sees them. */
    stage_plan?: StageId[]
    /** Stage the "Siguiente" action leads to (server-computed). */
    next_stage?: StageId | null
    production_outcome?: WorkOrderProductionOutcome | null
}

export interface WorkOrderProductionOutcome {
    kind: "STOCK" | "SALE_ORDER" | string
    finished_at: string
    product_name: string
    quantity: number
    stocked: boolean
    warehouse_name: string
    sale_order: { id: number; number: string } | null
    delivery: {
        status: "PARTIAL" | "DELIVERED" | string
        ordered: number
        delivered: number
    } | null
}

export interface BOMLine {
    id?: number
    component: string | number
    component_name?: string
    component_code?: string
    component_cost?: number
    /** Component's base UoM: component_cost is expressed per this unit. */
    component_uom?: number
    quantity: number
    uom?: string | number
    uom_name?: string
    uom_category?: number
    is_outsourced: boolean
    supplier?: string | number
    supplier_name?: string
    unit_price?: string
    document_type?: string
    notes?: string
}

export interface BOM {
    id?: number
    product: number
    product_name?: string
    product_internal_code?: string
    product_code?: string
    name: string
    active: boolean
    /** List fields sent by `BillOfMaterialsSerializer`. */
    lines_count?: number
    total_cost?: number
    yield_quantity: number
    yield_uom?: number
    yield_uom_name?: string
    estimated_prepress_min?: number
    estimated_press_min?: number
    estimated_postpress_min?: number
    lines: BOMLine[]
    notes?: string
    updated_at?: string
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
    uom?: UoM | number | string | { name: string }
    purchase_uom?: number | string | { id: number; name: string }
    uom_name?: string
    uom_category?: number
    last_purchase_price?: string | number
    cost_price?: number | string
    has_variants?: boolean
    track_inventory?: boolean
    requires_bom_validation?: boolean
    requires_advanced_manufacturing?: boolean
    mfg_auto_finalize?: boolean
    receiving_warehouse?: number | string | { id: number; name: string }
    preferred_supplier?: number | string | { id: number; name: string }
    preferred_supplier_name?: string
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

// ── Wizard navigation governance ──────────────────────────────────────────────

export type WizardStepMode = 'view' | 'edit-in-place'

export interface StepCapabilities {
    canView: boolean
    canEdit: boolean
    canRewind: boolean
    rewindBlockedReason?: string
    editBlockedReason?: string
}

// Provided by backend serializer (Phase 4); used by governance to avoid
// re-deriving from client-visible order data.
export interface WorkOrderSideEffects {
    has_confirmed_pos: boolean
    has_stock_movements: boolean
    completed_tasks_count: number
    manually_edited_materials_count: number
    /** Irreversible effects that block a rewind (the only ones the server enforces). */
    rewind_blockers?: string[]
    /** Blockers per reopenable stage: purchase orders only block reopening outsourcing. */
    rewind_blockers_by_stage?: Record<string, string[]>
}
