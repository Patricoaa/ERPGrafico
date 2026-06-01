import type { WorkOrder } from "./types"

export function isWorkOrderOverdue(order: Pick<WorkOrder, 'due_date' | 'status'>): boolean {
    if (!order.due_date || order.status === 'FINISHED' || order.status === 'CANCELLED') {
        return false
    }
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const [year, month, day] = order.due_date.split('-').map(Number)
    const dueDate = new Date(year, month - 1, day)
    
    return dueDate < today
}

/**
 * Determines which stages are valid targets for a forward transition
 * based on the Work Order's manufacturing profile.
 */
export function getAvailableNextStages(order: WorkOrder): string[] {
    const Stage = {
        MATERIAL_ASSIGNMENT: 'MATERIAL_ASSIGNMENT',
        MATERIAL_APPROVAL: 'MATERIAL_APPROVAL',
        OUTSOURCING_ASSIGNMENT: 'OUTSOURCING_ASSIGNMENT',
        PREPRESS: 'PREPRESS',
        PRESS: 'PRESS',
        POSTPRESS: 'POSTPRESS',
        OUTSOURCING_VERIFICATION: 'OUTSOURCING_VERIFICATION',
        RECTIFICATION: 'RECTIFICATION',
        FINISHED: 'FINISHED',
        CANCELLED: 'CANCELLED',
    }

    // Mapping of current stage to allowed NEXT stages (forward only)
    // Matches FORWARD_ONLY_TRANSITIONS in backend services.py
    const FORWARD_MAP: Record<string, string[]> = {
        [Stage.MATERIAL_ASSIGNMENT]: [
            Stage.MATERIAL_APPROVAL, Stage.OUTSOURCING_ASSIGNMENT,
            Stage.PREPRESS, Stage.PRESS, Stage.CANCELLED,
        ],
        [Stage.MATERIAL_APPROVAL]: [
            Stage.OUTSOURCING_ASSIGNMENT, Stage.PREPRESS, Stage.PRESS, Stage.CANCELLED,
        ],
        [Stage.OUTSOURCING_ASSIGNMENT]: [
            Stage.PREPRESS, Stage.PRESS, Stage.CANCELLED,
        ],
        [Stage.PREPRESS]: [
            Stage.PRESS, Stage.POSTPRESS, Stage.CANCELLED,
        ],
        [Stage.PRESS]: [
            Stage.POSTPRESS, Stage.OUTSOURCING_VERIFICATION, Stage.RECTIFICATION, Stage.CANCELLED,
        ],
        [Stage.POSTPRESS]: [
            Stage.OUTSOURCING_VERIFICATION, Stage.RECTIFICATION, Stage.CANCELLED,
        ],
        [Stage.OUTSOURCING_VERIFICATION]: [
            Stage.RECTIFICATION, Stage.CANCELLED,
        ],
        [Stage.RECTIFICATION]: [
            Stage.FINISHED, Stage.CANCELLED,
        ],
    }

    const rawAllowed = FORWARD_MAP[order.current_stage] || []
    
    // Filter by manufacturing profile (requires_prepress, etc.)
    return rawAllowed.filter(stageId => {
        if (stageId === Stage.PREPRESS && !order.requires_prepress) return false
        if (stageId === Stage.PRESS && !order.requires_press) return false
        if (stageId === Stage.POSTPRESS && !order.requires_postpress) return false
        
        // MATERIAL_APPROVAL is only relevant if there are manual/stock materials (not just outsourced)
        if (stageId === Stage.MATERIAL_APPROVAL) {
            return (order.materials ?? []).some(m => !m.is_outsourced)
        }
        
        // OUTSOURCING_VERIFICATION only if there are outsourced materials
        if (stageId === Stage.OUTSOURCING_VERIFICATION) {
            return (order.materials ?? []).some(m => m.is_outsourced)
        }

        return true
    })
}

