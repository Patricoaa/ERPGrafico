import { formatPlainDate } from "@/lib/utils"

import type { WorkOrder, WorkOrderMaterial } from "../types"

/**
 * Derived, render-ready evidence for one work-order stage.
 *
 * The left rail used to be a table of contents: label + status only. Direction C
 * turns it into a status board, so every stage needs a one-line "what happened"
 * summary and, when it applies, a blocker warning.
 */
export interface StageEvidence {
    /** Latest `stage_history` entry that put the OT into this stage. */
    enteredAt?: string
    enteredBy?: string
    pendingTasks: number
    completedTasks: number
    materialsTotal: number
    materialsAvailable: number
    materialsMissing: number
    outsourcedTotal: number
    /** Human-readable blocker shown on the rail (materials, approvals...). */
    warning?: string
}

export type StageEvidenceMap = Record<string, StageEvidence>

/** Approval task types that belong to a workflow stage. */
export const TASK_TYPE_TO_STAGE: Record<string, string> = {
    OT_MATERIAL_APPROVAL: "MATERIAL_APPROVAL",
    OT_PREPRESS_APPROVAL: "PREPRESS",
    OT_PRESS_APPROVAL: "PRESS",
    OT_POSTPRESS_APPROVAL: "POSTPRESS",
    OT_OUTSOURCING_VERIFICATION_APPROVAL: "OUTSOURCING_VERIFICATION",
    OT_RECTIFICATION_APPROVAL: "RECTIFICATION",
}

const PENDING_STATUSES = new Set(["PENDING", "IN_PROGRESS"])
const PRODUCTION_STAGES = new Set(["PREPRESS", "PRESS", "POSTPRESS"])
const CLOSING_STAGES = new Set([
    "OUTSOURCING_VERIFICATION",
    "RECTIFICATION",
    "FINISHED",
])

function emptyEvidence(): StageEvidence {
    return {
        pendingTasks: 0,
        completedTasks: 0,
        materialsTotal: 0,
        materialsAvailable: 0,
        materialsMissing: 0,
        outsourcedTotal: 0,
    }
}

function isMaterialAvailable(material: WorkOrderMaterial): boolean {
    if (material.is_available !== undefined) return material.is_available
    const available = material.stock_available ?? 0
    const required = material.quantity_planned ?? 0
    return available >= required
}

function plural(count: number, singular: string, pluralForm: string): string {
    return `${count} ${count === 1 ? singular : pluralForm}`
}

/**
 * Build per-stage evidence from data the detail endpoint already returns
 * (`stage_history`, `workflow_tasks`, `materials`). Pure and cheap enough to
 * memoize on the order identity.
 */
export function deriveStageEvidence(order: WorkOrder | null | undefined): StageEvidenceMap {
    const result: StageEvidenceMap = {}
    if (!order) return result

    const ensure = (stage: string): StageEvidence => {
        if (!result[stage]) result[stage] = emptyEvidence()
        return result[stage]
    }

    // 1. Stage history: keep the latest entry per stage (API may sort either way).
    for (const entry of order.stage_history ?? []) {
        if (!entry?.stage) continue
        const evidence = ensure(entry.stage)
        const current = evidence.enteredAt ? new Date(evidence.enteredAt).getTime() : -Infinity
        const candidate = new Date(entry.created_at).getTime()
        if (Number.isFinite(candidate) && candidate > current) {
            evidence.enteredAt = entry.created_at
            evidence.enteredBy = entry.user_name?.trim() || undefined
        }
    }

    // 2. Approval tasks mapped to their stage.
    for (const task of order.workflow_tasks ?? []) {
        const stage = TASK_TYPE_TO_STAGE[task.task_type]
        if (!stage) continue
        const evidence = ensure(stage)
        if (PENDING_STATUSES.has(task.status)) evidence.pendingTasks += 1
        else if (task.status === "COMPLETED") evidence.completedTasks += 1
    }

    // 3. Materials: manual stock vs. outsourced services.
    const materials = order.materials ?? []
    const manual = materials.filter((material) => !material.is_outsourced)
    if (manual.length > 0) {
        const evidence = ensure("MATERIAL_ASSIGNMENT")
        evidence.materialsTotal = manual.length
        evidence.materialsAvailable = manual.filter(isMaterialAvailable).length
        evidence.materialsMissing = manual.length - evidence.materialsAvailable
    }

    const outsourced = materials.filter((material) => material.is_outsourced)
    if (outsourced.length > 0) {
        ensure("OUTSOURCING_ASSIGNMENT").outsourcedTotal = outsourced.length
    }

    // 4. Warnings ("why can't I advance?"), only where the operator can act.
    for (const [stage, evidence] of Object.entries(result)) {
        if (stage === "MATERIAL_ASSIGNMENT" && evidence.materialsMissing > 0) {
            evidence.warning = `${plural(evidence.materialsMissing, "material sin stock", "materiales sin stock")}`
        }
        if (stage === "MATERIAL_APPROVAL" && evidence.pendingTasks > 0) {
            evidence.warning = `${plural(evidence.pendingTasks, "aprobación pendiente", "aprobaciones pendientes")}`
        }
        if (stage === "OUTSOURCING_VERIFICATION" && evidence.pendingTasks > 0) {
            evidence.warning = `${plural(evidence.pendingTasks, "verificación pendiente", "verificaciones pendientes")}`
        }
        if (
            stage !== "MATERIAL_APPROVAL" &&
            stage !== "OUTSOURCING_VERIFICATION" &&
            evidence.pendingTasks > 0
        ) {
            evidence.warning = `${plural(evidence.pendingTasks, "tarea pendiente", "tareas pendientes")}`
        }
    }

    return result
}

/** Section the stage belongs to. Keeps the 13-step rail chunked in 3 groups. */
export function stageGroup(stageId: string): "Preparación" | "Producción" | "Cierre" {
    if (PRODUCTION_STAGES.has(stageId)) return "Producción"
    if (CLOSING_STAGES.has(stageId)) return "Cierre"
    return "Preparación"
}

function historyLine(evidence: StageEvidence | undefined, isCurrent: boolean): string | undefined {
    if (!evidence?.enteredAt) return undefined
    const date = formatPlainDate(evidence.enteredAt)
    const suffix = evidence.enteredBy ? ` · ${evidence.enteredBy}` : ""
    return `${isCurrent ? "Desde " : ""}${date}${suffix}`
}

/**
 * One-line summary for the rail. Prefers operational data (counts, specs) and
 * falls back to the history timestamp so every past/current stage has context.
 */
export function stageSummary(
    stageId: string,
    evidence: StageEvidence | undefined,
    order: WorkOrder | null | undefined,
    isCurrent = false,
): string | undefined {
    if (!order) return undefined

    switch (stageId) {
        case "ORIGIN_SELECTION": {
            const saleOrderNumber = order.sale_order?.number
            if (saleOrderNumber) {
                return /^[A-Za-z]/.test(saleOrderNumber)
                    ? `Vinculada a ${saleOrderNumber}`
                    : `Vinculada a OV #${saleOrderNumber}`
            }
            return order.is_manual ? "Fabricación manual" : "Fabricación para stock"
        }
        case "SALE_ORDER_PRODUCT":
        case "PRODUCT_SELECTION": {
            const name = order.product_name || order.sale_line?.product?.name
            return name || undefined
        }
        case "MFG_CONFIG": {
            if (order.quantity != null && order.uom_name) {
                return `${order.quantity} ${order.uom_name}`
            }
            return order.quantity != null ? String(order.quantity) : undefined
        }
        case "MATERIAL_ASSIGNMENT": {
            if (!evidence?.materialsTotal) return "Sin materiales asignados"
            const available = `${evidence.materialsAvailable}/${evidence.materialsTotal} disponibles`
            return evidence.materialsMissing > 0
                ? `${available} · ${evidence.materialsMissing} faltante${evidence.materialsMissing === 1 ? "" : "s"}`
                : available
        }
        case "MATERIAL_APPROVAL": {
            if (evidence?.pendingTasks) return `${evidence.pendingTasks} pendiente${evidence.pendingTasks === 1 ? "" : "s"}`
            if (evidence?.completedTasks) return `${evidence.completedTasks} aprobada${evidence.completedTasks === 1 ? "" : "s"}`
            return historyLine(evidence, isCurrent) ?? "Sin tareas"
        }
        case "OUTSOURCING_ASSIGNMENT": {
            if (!evidence?.outsourcedTotal) return "Sin tercerizados"
            return plural(evidence.outsourcedTotal, "servicio tercerizado", "servicios tercerizados")
        }
        case "PREPRESS":
            return order.stage_data?.prepress_specs || historyLine(evidence, isCurrent)
        case "PRESS":
            return order.stage_data?.press_specs || historyLine(evidence, isCurrent)
        case "POSTPRESS":
            return order.stage_data?.postpress_specs || historyLine(evidence, isCurrent)
        case "OUTSOURCING_VERIFICATION": {
            const total = (evidence?.pendingTasks ?? 0) + (evidence?.completedTasks ?? 0)
            if (total > 0) {
                return `${evidence?.completedTasks ?? 0}/${total} verificados`
            }
            return historyLine(evidence, isCurrent)
        }
        case "RECTIFICATION": {
            if (order.quantity != null && order.quantity > 0) {
                const produced = order.actual_quantity_produced
                if (produced != null) return `${produced}/${order.quantity} producidas`
            }
            return historyLine(evidence, isCurrent)
        }
        case "FINISHED":
            return evidence?.enteredAt ? `Cerrada ${formatPlainDate(evidence.enteredAt)}` : undefined
        default:
            return historyLine(evidence, isCurrent)
    }
}
