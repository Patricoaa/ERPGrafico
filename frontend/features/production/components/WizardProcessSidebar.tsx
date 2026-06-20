"use client"

import { cn } from "@/lib/utils"
import { CheckCircle2, Eye, Pencil, RotateCcw } from "lucide-react"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

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

export function WizardProcessSidebar({
    stages,
    viewingStepIndex,
    actualStepIndex,
    stepMode,
    onStepClick,
    order,
}: WizardProcessSidebarProps) {
    return (
        <TooltipProvider delayDuration={300}>
            <div className="w-64 border-r h-full overflow-y-auto shrink-0 hidden md:flex md:flex-col">
                <div className="p-4 space-y-2 flex-1">
                <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 px-2">
                    Etapas de Producción
                </h3>

                {stages.map((stage, index) => {
                    const Icon = stage.icon
                    const isActive = viewingStepIndex === index
                    const isPast = actualStepIndex > index
                    const isCurrent = actualStepIndex === index
                    const isFuture = actualStepIndex < index
                    const isCreationStep = stage.isCreationStep ?? false

                    // Compute mode indicator for the active step
                    const showEditDot = isActive && stepMode === 'edit-in-place'
                    const showRewindDot = isActive && stepMode === 'rewind'

                    // Governance: only for past steps when an order exists
                    const capabilities = isPast && order
                        ? getStepCapabilities(stage.id, order)
                        : null

                    // Future stages are not clickable — they haven't happened yet.
                    const isClickable = !isFuture

                    const rowContent = (
                        <div
                            key={stage.id}
                            onClick={isClickable ? () => onStepClick(index, 'view') : undefined}
                            aria-disabled={!isClickable}
                            className={cn(
                                "group rounded-lg transition-all duration-200",
                                isClickable ? "cursor-pointer" : "cursor-not-allowed",
                                isActive && isCreationStep && "bg-accent text-accent-foreground shadow-card",
                                isActive && !isCreationStep && "bg-primary text-primary-foreground shadow-card",
                                isPast && !isActive && isCreationStep && "bg-success/5 text-success hover:bg-success/10",
                                isPast && !isActive && !isCreationStep && "bg-success/10 text-success hover:bg-success/20",
                                isCurrent && !isActive && isCreationStep && "bg-accent/50 border border-accent/20 text-accent-foreground hover:border-accent/50",
                                isCurrent && !isActive && !isCreationStep && "bg-card border border-primary/20 text-foreground hover:border-primary/50",
                                isFuture && isCreationStep && "text-success/40 opacity-60",
                                isFuture && !isCreationStep && "text-muted-foreground/60 opacity-60"
                            )}
                        >
                            <div className="flex items-center space-x-3 p-3">
                                <Icon className={cn("h-5 w-5 shrink-0",
                                    isActive && isCreationStep ? "text-accent-foreground" :
                                    isActive && !isCreationStep ? "text-primary-foreground" :
                                    isPast ? "text-success" :
                                    isCurrent && !isActive ? "text-primary-foreground" :
                                    "text-muted-foreground"
                                )} />

                                <span className="text-sm font-medium flex-1 truncate">{stage.label}</span>

                                {/* ── Trailing indicators ── */}
                                {isPast && capabilities && (
                                    <div className="flex items-center gap-0.5">
                                        {/* Default: checkmark — hidden on hover to show actions */}
                                        <CheckCircle2 className={cn(
                                            "h-4 w-4 transition-opacity",
                                            "group-hover:opacity-0 group-hover:w-0 group-hover:overflow-hidden",
                                            isActive ? "text-primary-foreground" : "text-success"
                                        )} />

                                        {/* Hover: action buttons */}
                                        <div
                                            className="hidden group-hover:flex items-center gap-0.5"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {/* View */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        className={cn(
                                                            "p-1 rounded hover:bg-accent transition-colors",
                                                            isActive && stepMode === 'view' && "bg-accent"
                                                        )}
                                                        onClick={() => onStepClick(index, 'view')}
                                                        aria-label="Ver etapa"
                                                    >
                                                        <Eye className="h-3.5 w-3.5" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="right">Ver etapa (solo lectura)</TooltipContent>
                                            </Tooltip>

                                            {/* Edit-in-place */}
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <button
                                                        disabled={!capabilities.canEdit}
                                                        className={cn(
                                                            "p-1 rounded hover:bg-accent transition-colors",
                                                            !capabilities.canEdit && "opacity-30 cursor-not-allowed",
                                                            isActive && stepMode === 'edit-in-place' && "bg-info/20"
                                                        )}
                                                        onClick={() => capabilities.canEdit && onStepClick(index, 'edit-in-place')}
                                                        aria-label="Editar datos de etapa"
                                                    >
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </button>
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
                                                    <button
                                                        disabled={!capabilities.canRewind}
                                                        className={cn(
                                                            "p-1 rounded hover:bg-accent transition-colors",
                                                            !capabilities.canRewind && "opacity-30 cursor-not-allowed",
                                                            isActive && stepMode === 'rewind' && "bg-warning/20"
                                                        )}
                                                        onClick={() => capabilities.canRewind && onStepClick(index, 'rewind')}
                                                        aria-label="Retroceder a esta etapa"
                                                    >
                                                        <RotateCcw className="h-3.5 w-3.5" />
                                                    </button>
                                                </TooltipTrigger>
                                                <TooltipContent side="right">
                                                    {capabilities.canRewind
                                                        ? "Retroceder a esta etapa"
                                                        : capabilities.rewindBlockedReason ?? "No se puede retroceder en este estado"}
                                                </TooltipContent>
                                            </Tooltip>
                                        </div>
                                    </div>
                                )}

                                {/* Non-past trailing indicators */}
                                {isPast && !capabilities && (
                                    <CheckCircle2 className={cn("h-4 w-4",
                                        isActive ? "text-primary-foreground" : "text-success"
                                    )} />
                                )}
                                {isCurrent && !isActive && (
                                    <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                                )}

                                {/* Mode indicator dot for the active step */}
                                {showEditDot && (
                                    <div className="h-2 w-2 rounded-full bg-info" />
                                )}
                                {showRewindDot && (
                                    <div className="h-2 w-2 rounded-full bg-warning" />
                                )}
                            </div>
                        </div>
                    )

                    if (isFuture) {
                        return (
                            <Tooltip key={stage.id}>
                                <TooltipTrigger asChild>{rowContent}</TooltipTrigger>
                                <TooltipContent side="right">
                                    Etapa pendiente — aún no alcanzada en el proceso
                                </TooltipContent>
                            </Tooltip>
                        )
                    }

                    return rowContent
                })}
                </div>
            </div>
        </TooltipProvider>
    )
}
