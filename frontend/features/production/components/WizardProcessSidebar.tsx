"use client"

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

interface WizardProcessSidebarProps {
    stages: WorkOrderStage[]
    viewingStepIndex: number
    actualStepIndex: number
    stepMode: WizardStepMode
    onStepClick: (index: number, mode: WizardStepMode) => void
    order: WorkOrder | null
}

/**
 * WizardProcessSidebar — Production adapter over the shared `WizardStepsSidebar`.
 *
 * Production has richer per-stage semantics than the generic rail:
 *  - a "viewing" index that can differ from the "actual" (owned) stage
 *  - per-stage governance (canEdit / canRewind) driven by `getStepCapabilities`
 *  - a step mode (view / edit-in-place / rewind) surfaced as an indicator dot
 *  - future stages are not clickable
 *
 * Those rules are mapped onto the shared API: `status` drives the base look,
 * `disabled` controls clickability, and `renderStepActions` renders the
 * governance buttons.
 */
export function WizardProcessSidebar({
    stages,
    viewingStepIndex,
    actualStepIndex,
    stepMode,
    onStepClick,
    order,
}: WizardProcessSidebarProps) {
    const steps: WizardSidebarStep[] = stages.map((stage, index) => {
        const isActive = viewingStepIndex === index
        const isPast = actualStepIndex > index
        const isCurrent = actualStepIndex === index
        const isFuture = actualStepIndex < index

        const status: WizardStepStatus = isActive ? "active" : isPast ? "past" : "future"

        return {
            id: stage.id,
            label: stage.label,
            icon: stage.icon,
            status,
            disabled: isFuture,
            // `group` enables the hover-reveal of the governance actions
            // rendered by `renderStepActions`. The rest maps production's
            // creation-step palette onto the shared status colours (cn/twMerge
            // lets these override the base classes).
            className: cn(
                "group",
                isFuture && "cursor-not-allowed",
                isActive && (stage.isCreationStep ?? false) && "bg-accent text-accent-foreground",
                isPast && (stage.isCreationStep ?? false) && "bg-success/5 hover:bg-success/10",
                isPast && !(stage.isCreationStep ?? false) && "hover:bg-success/20",
                isCurrent && !isActive && (stage.isCreationStep ?? false) && "bg-accent/50 border border-accent/20 hover:border-accent/50",
                isCurrent && !isActive && !(stage.isCreationStep ?? false) && "bg-card border border-primary/20 hover:border-primary/50",
                isFuture && (stage.isCreationStep ?? false) && "text-success/40 opacity-60",
                isFuture && !(stage.isCreationStep ?? false) && "text-muted-foreground/60 opacity-60",
            ),
        }
    })

    return (
        <TooltipProvider delayDuration={300}>
            <WizardStepsSidebar
                title="Etapas"
                currentStep={viewingStepIndex + 1}
                steps={steps}
                width="w-52"
                className="p-3 space-y-0.5 bg-transparent"
                onStepClick={(index) => onStepClick(index, 'view')}
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
                        if (stepMode === 'edit-in-place') return <div className="h-2 w-2 rounded-full bg-info animate-pulse" />
                        if (stepMode === 'rewind') return <div className="h-2 w-2 rounded-full bg-warning animate-pulse" />
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
                            return <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
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
                                                isActive && stepMode === 'view' && "bg-accent",
                                            )}
                                            onClick={() => onStepClick(index, 'view')}
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
                                                isActive && stepMode === 'edit-in-place' && "bg-info/20",
                                            )}
                                            onClick={() => capabilities.canEdit && onStepClick(index, 'edit-in-place')}
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
                                                isActive && stepMode === 'rewind' && "bg-warning/20",
                                            )}
                                            onClick={() => capabilities.canRewind && onStepClick(index, 'rewind')}
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
