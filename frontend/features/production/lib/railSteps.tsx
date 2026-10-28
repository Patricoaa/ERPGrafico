import type { ReactNode } from "react"

import type { WizardSidebarStep, WizardStepStatus } from "@/components/shared"
import { cn } from "@/lib/utils"

import type { WorkOrder, WorkOrderStage, WizardStepMode } from "../types"
import { deriveStageEvidence, stageGroup, stageSummary } from "./stageEvidence"

function RailBadge({ children }: { children: ReactNode }) {
    return (
        <span
            className={cn(
                "text-2xs font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap",
                "text-primary bg-primary/10 border-primary/30",
            )}
        >
            {children}
        </span>
    )
}

export interface BuildWorkOrderRailStepsArgs {
    stages: WorkOrderStage[]
    viewingStepIndex: number
    actualStepIndex: number
    stepMode: WizardStepMode
    order: WorkOrder | null
}

/**
 * Shared projection for the desktop rail and the mobile stage sheet.
 *
 * Keeping this in one place guarantees that the status board and the mobile
 * picker show the same status, detail and blocker warning for every stage.
 */
export function buildWorkOrderRailSteps({
    stages,
    viewingStepIndex,
    actualStepIndex,
    stepMode,
    order,
}: BuildWorkOrderRailStepsArgs): WizardSidebarStep[] {
    const evidence = deriveStageEvidence(order)
    const isTerminal = order?.status === "CANCELLED" || order?.status === "FINISHED"

    return stages.map((stage, index) => {
        const stageId = stage.id as string
        const isActive = viewingStepIndex === index
        const isPast = actualStepIndex > index
        const isCurrent = actualStepIndex === index
        const isFuture = actualStepIndex < index
        const stageEvidence = evidence[stageId]

        // Determine effective status
        let status: WizardStepStatus
        if (isActive) {
            status = "active"
        } else if (isCurrent && !isActive) {
            // The actual current stage (where the order really is) but we're viewing a different one
            status = "current"
        } else if (isPast) {
            status = "past"
        } else {
            status = "future"
        }

        const badge = isCurrent && !isActive
            ? <RailBadge>Actual</RailBadge>
            : undefined

        return {
            id: stage.id,
            label: stage.label,
            icon: stage.icon,
            group: stageGroup(stageId),
            detail: stageSummary(stageId, stageEvidence, order, isCurrent),
            // The blocker belongs to the stage the order is in; past and future rows stay quiet.
            warning: !isTerminal && isCurrent ? stageEvidence?.warning : undefined,
            status,
            disabled: isFuture,
            className: cn("group"),
            badge,
        }
    })
}
