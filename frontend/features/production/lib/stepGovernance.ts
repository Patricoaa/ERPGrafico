import type { WorkOrder, StepCapabilities } from '../types'
import type { StageId } from '../constants/stages'
import { hasSideEffects } from './sideEffects'

// Steps that exist only during OT creation and carry no workflow stage in the backend.
const CREATION_STEP_IDS = new Set([
    'ORIGIN_SELECTION',
    'SALE_ORDER_PRODUCT',
    'PRODUCT_SELECTION',
    'MFG_CONFIG',
])

// Stages that remain editable while the OT is still in DRAFT.
const DRAFT_EDITABLE_STAGES = new Set<StageId>([
    'MATERIAL_ASSIGNMENT',
    'MATERIAL_APPROVAL',
])

/**
 * Returns what actions are available when a user navigates to a *past* step
 * in the wizard sidebar. This is the single source of truth for the governance
 * matrix agreed in the design discussion.
 *
 * Does NOT apply to the current stage (user is already there) or future stages
 * (not yet accessible). Call only for steps whose index < actualStepIndex.
 */
export function getStepCapabilities(stage: string, order: WorkOrder): StepCapabilities {
    const { status } = order

    // Creation steps are summary-only once the OT exists.
    // MFG_CONFIG gets per-section editability via mfgConfigEditability.ts.
    if (CREATION_STEP_IDS.has(stage)) {
        if (stage === 'MFG_CONFIG' && status !== 'FINISHED' && status !== 'CANCELLED') {
            return { canView: true, canEdit: true, canRewind: false }
        }
        return { canView: true, canEdit: false, canRewind: false }
    }

    // Terminal states: full read-only across all steps.
    if (status === 'FINISHED' || status === 'CANCELLED') {
        return { canView: true, canEdit: false, canRewind: false }
    }

    // DRAFT: MATERIAL_ASSIGNMENT and MATERIAL_APPROVAL allow edit + rewind
    // (no side-effects check needed — nothing irreversible happened yet).
    if (status === 'DRAFT' && DRAFT_EDITABLE_STAGES.has(stage as StageId)) {
        return { canView: true, canEdit: true, canRewind: true }
    }

    // IN_PROGRESS: all past workflow stages allow view; rewind requires no irreversible effects.
    if (status === 'IN_PROGRESS') {
        const se = hasSideEffects(order, stage)
        // Services can still be changed until their purchase orders exist.
        const canEditOutsourcing = stage === 'OUTSOURCING_ASSIGNMENT' && !se.blocked
        return {
            canView: true,
            canEdit: canEditOutsourcing,
            editBlockedReason: canEditOutsourcing
                ? undefined
                : stage === 'OUTSOURCING_ASSIGNMENT'
                    ? se.reason
                    : 'Esta etapa ya se cerró. Retrocede a ella para modificarla.',
            canRewind: !se.blocked,
            rewindBlockedReason: se.blocked ? se.reason : undefined,
        }
    }

    return { canView: true, canEdit: false, canRewind: false }
}
