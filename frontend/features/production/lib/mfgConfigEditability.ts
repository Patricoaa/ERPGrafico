import type { WorkOrder } from '../types'

export type MfgSection = 'identity' | 'volume' | 'prepress' | 'press' | 'postpress' | 'planning'

export interface SectionEditability {
    canEdit: boolean
    reason?: string
}

const STAGE_ORDER = [
    'MATERIAL_ASSIGNMENT',
    'MATERIAL_APPROVAL',
    'OUTSOURCING_ASSIGNMENT',
    'PREPRESS',
    'PRESS',
    'POSTPRESS',
    'OUTSOURCING_VERIFICATION',
    'RECTIFICATION',
    'FINISHED',
]

/**
 * Returns whether a specific section of MFG_CONFIG can be edited
 * for an existing OT, based on status and current stage.
 */
export function canEditMfgSection(section: MfgSection, order: WorkOrder): SectionEditability {
    const { status, current_stage } = order

    if (section === 'identity') {
        return { canEdit: false, reason: 'Producto y NV no son modificables después de crear la OT.' }
    }

    if (status === 'FINISHED' || status === 'CANCELLED') {
        return { canEdit: false, reason: 'La OT está cerrada.' }
    }

    if (section === 'planning') {
        return { canEdit: true }
    }

    if (section === 'volume') {
        if (status !== 'DRAFT') {
            return { canEdit: false, reason: 'El volumen solo es modificable mientras la OT está en Borrador.' }
        }
        if (order.sale_order_number || order.sale_order) {
            return { canEdit: false, reason: 'La cantidad se hereda de la Nota de Venta. Edite la línea en la NV o use "Crear OT corregida".' }
        }
        const hasConfirmedPO = (order.materials ?? []).some(
            (m) => m.is_outsourced && m.purchase_order_number
        )
        if (hasConfirmedPO) {
            return { canEdit: false, reason: 'Existen OC generadas para tercerizados. No se puede modificar la cantidad.' }
        }
        return { canEdit: true }
    }

    // MfgConfig sub-phases: locked once that phase has started
    const currentIdx = STAGE_ORDER.indexOf(current_stage)

    if (section === 'prepress') {
        if (currentIdx >= STAGE_ORDER.indexOf('PREPRESS')) {
            return { canEdit: false, reason: 'La etapa de Pre-Impresión ya ha comenzado.' }
        }
        return { canEdit: true }
    }

    if (section === 'press') {
        if (currentIdx >= STAGE_ORDER.indexOf('PRESS')) {
            return { canEdit: false, reason: 'La etapa de Impresión ya ha comenzado.' }
        }
        return { canEdit: true }
    }

    if (section === 'postpress') {
        if (currentIdx >= STAGE_ORDER.indexOf('POSTPRESS')) {
            return { canEdit: false, reason: 'La etapa de Post-Impresión ya ha comenzado.' }
        }
        return { canEdit: true }
    }

    return { canEdit: false }
}
