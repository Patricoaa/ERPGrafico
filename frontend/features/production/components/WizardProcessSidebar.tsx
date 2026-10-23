"use client"

import { useMemo } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { CheckCircle2, Eye, Pencil, RotateCcw } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

import { WizardStepsSidebar, type WizardSidebarStep, type WizardStepStatus } from "@/components/shared"

import type { WorkOrderStage, WorkOrder, WizardStepMode } from "../types"
import { getStepCapabilities } from "../lib/stepGovernance"
import { deriveStageEvidence, stageGroup, stageSummary } from "../lib/stageEvidence"

interface WizardProcessSidebarProps {
    stages: WorkOrderStage[]
    viewingStepIndex: number
    actualStepIndex: number
    stepMode: WizardStepMode
    onStepClick: (index: number, mode: WizardStepMode) => void
    order: WorkOrder | null
}

export function WizardProcessSidebar({
    stages,
    viewingStepIndex,
    actualStepIndex,
    stepMode,
    onStepClick,
    order,
}: WizardProcessSidebarProps) {
    const evidence = useMemo(() => deriveStageEvidence(order), [order])

    const steps: WizardSidebarStep[] = stages.map((stage, index) => {
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

        return {
            id: stage.id,
            label: stage.label,
            icon: stage.icon,
            group: stageGroup(stageId),
            detail: stageSummary(stageId, stageEvidence, order, isCurrent),
            // Only warn where the operator can still act: current and future stages.
            warning: index >= actualStepIndex ? stageEvidence?.warning : undefined,
            status,
            disabled: isFuture,
            className: cn("group"),
            badge: isCurrent && !isActive && (
                <span className="text-2xs font-semibold text-primary px-1.5 py-0.5 bg-primary/10 rounded border border-primary/30">
                    Actual
                </span>
            ),
        }
    })

    const progressPercent = actualStepIndex >= 0 && stages.length > 0
        ? ((actualStepIndex + 1) / stages.length) * 100
        : undefined

    return (
        <TooltipProvider delayDuration={300}>
            <WizardStepsSidebar
                title="Etapas"
                currentStep={viewingStepIndex + 1}
                steps={steps}
                width="w-64"
                className="p-2 space-y-0 bg-transparent"
                onStepClick={(index) => onStepClick(index, "view")}
                showNumbers={true}
                detailVisibility="both"
                progressPercent={progressPercent}
                counterLabel="Viendo"
                renderStepActions={(step, index) => {
                    const isActive = viewingStepIndex === index
                    const isPast = actualStepIndex > index
                    const isCurrent = actualStepIndex === index

                    // Governance: only for past steps when an order exists.
                    const capabilities = isPast && order
                        ? getStepCapabilities(step.id as string, order)
                        : null

                    // Mode indicator on the currently viewed step.
                    if (isActive) {
                        if (stepMode === "edit-in-place") return <div className="h-1.5 w-1.5 rounded-full bg-info animate-pulse" />
                        if (stepMode === "rewind") return <div className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
                    }

                    if (!capabilities) {
                        if (isPast) {
                            return (
                                <CheckCircle2 className={cn(
                                    "h-3.5 w-3.5",
                                    isActive ? "text-primary-foreground" : "text-success",
                                )} />
                            )
                        }
                        if (isCurrent && !isActive) {
                            return <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        }
                        return null
                    }

                    return (
                        <div
                            className="flex items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <CheckCircle2 className={cn(
                                "h-3.5 w-3.5 transition-opacity",
                                "group-hover:opacity-0 group-hover:w-0 group-hover:overflow-hidden",
                                isActive ? "text-primary-foreground" : "text-success",
                            )} />

                            <div className="hidden group-hover:flex items-center gap-0.5">
                                {/* View */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            className={cn(
                                                "p-1 rounded hover:bg-accent transition-colors h-auto w-auto border-none bg-transparent shadow-none",
                                                isActive && stepMode === "view" && "bg-accent",
                                            )}
                                            onClick={() => onStepClick(index, "view")}
                                            aria-label="Ver etapa"
                                        >
                                            <Eye className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">Ver etapa (solo lectura)</TooltipContent>
                                </Tooltip>

                                {/* Edit-in-place */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            disabled={!capabilities.canEdit}
                                            className={cn(
                                                "p-1 rounded hover:bg-accent transition-colors h-auto w-auto border-none bg-transparent shadow-none",
                                                !capabilities.canEdit && "opacity-30 cursor-not-allowed",
                                                isActive && stepMode === "edit-in-place" && "bg-info/20",
                                            )}
                                            onClick={() => capabilities.canEdit && onStepClick(index, "edit-in-place")}
                                            aria-label="Editar datos de etapa"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        {capabilities.canEdit
                                            ? "Editar datos de esta etapa"
                                            : capabilities.editBlockedReason ?? "No se puede editar en este estado"}
                                    </TooltipContent>
                                </Tooltip>

                                {/* Rewind */}
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            disabled={!capabilities.canRewind}
                                            className={cn(
                                                "p-1 rounded hover:bg-accent transition-colors h-auto w-auto border-none bg-transparent shadow-none",
                                                !capabilities.canRewind && "opacity-30 cursor-not-allowed",
                                                isActive && stepMode === "rewind" && "bg-warning/20",
                                            )}
                                            onClick={() => capabilities.canRewind && onStepClick(index, "rewind")}
                                            aria-label="Retroceder a esta etapa"
                                        >
                                            <RotateCcw className="h-3.5 w-3.5" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">
                                        {capabilities.canRewind
                                            ? "Retroceder a esta etapa"
                                            : capabilities.rewindBlockedReason ?? "No se puede retroceder en este estado"}
                                    </TooltipContent>
                                </Tooltip>
                            </div>
                        </div>
                    )
                }}
            />
        </TooltipProvider>
    )
}