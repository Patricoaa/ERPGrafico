"use client"

import { useMemo, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { Eye, Pencil, RotateCcw, type LucideIcon } from "lucide-react"
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

interface StageActionProps {
    icon: LucideIcon
    label: string
    /** When present, the action is rendered as a focusable disabled control. */
    reason?: string
    active?: boolean
    tone?: "info" | "warning" | "view"
    onClick: () => void
}

/**
 * A governance action that stays reachable when blocked.
 *
 * A disabled `<button>` does not emit pointer events, so its tooltip never
 * fires (and on touch there is no hover at all). Blocked actions therefore
 * render as a focusable `role="button"` with `aria-disabled`, plus a native
 * `title` as fallback. Enabled actions use the regular Button.
 */
function StageAction({ icon: Icon, label, reason, active, tone, onClick }: StageActionProps) {
    const blocked = Boolean(reason)
    const className = cn(
        "p-1 rounded transition-colors h-auto w-auto border-none bg-transparent shadow-none",
        blocked ? "opacity-30 cursor-not-allowed" : "hover:bg-accent",
        active && tone === "view" && "bg-accent",
        active && tone === "info" && "bg-info/20",
        active && tone === "warning" && "bg-warning/20",
    )

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                {blocked ? (
                    <span
                        role="button"
                        tabIndex={0}
                        aria-disabled="true"
                        aria-label={`${label}: ${reason}`}
                        title={`${label}: ${reason}`}
                        className={className}
                        onClick={(event) => event.preventDefault()}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault()
                            }
                        }}
                    >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                ) : (
                    <Button
                        variant="ghost"
                        className={className}
                        onClick={onClick}
                        aria-label={label}
                    >
                        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    </Button>
                )}
            </TooltipTrigger>
            <TooltipContent side="right">
                {blocked ? reason : label}
            </TooltipContent>
        </Tooltip>
    )
}

function RailBadge({ children, tone = "primary" }: { children: ReactNode; tone?: "primary" | "info" | "warning" }) {
    return (
        <span
            className={cn(
                "text-2xs font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap",
                tone === "primary" && "text-primary bg-primary/10 border-primary/30",
                tone === "info" && "text-info bg-info/10 border-info/30",
                tone === "warning" && "text-warning bg-warning/10 border-warning/30",
            )}
        >
            {children}
        </span>
    )
}

interface WizardProcessSidebarProps {
    stages: WorkOrderStage[]
    viewingStepIndex: number
    actualStepIndex: number
    stepMode: WizardStepMode
    onStepClick: (index: number, mode: WizardStepMode) => void
    order: WorkOrder | null
    collapsed?: boolean
    onToggleCollapsed?: () => void
}

export function WizardProcessSidebar({
    stages,
    viewingStepIndex,
    actualStepIndex,
    stepMode,
    onStepClick,
    order,
    collapsed,
    onToggleCollapsed,
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

        const badge = isActive && stepMode === "edit-in-place"
            ? <RailBadge tone="info">Editando</RailBadge>
            : isActive && stepMode === "rewind"
            ? <RailBadge tone="warning">Retroceso</RailBadge>
            : isCurrent && !isActive
            ? <RailBadge>Actual</RailBadge>
            : undefined

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
            badge,
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
                className="bg-transparent"
                onStepClick={(index) => onStepClick(index, "view")}
                showNumbers={true}
                detailVisibility="both"
                progressPercent={progressPercent}
                counterLabel="Viendo"
                collapsed={collapsed}
                onToggleCollapsed={onToggleCollapsed}
                renderStepActions={(step, index) => {
                    const isActive = viewingStepIndex === index
                    const isPast = actualStepIndex > index

                    if (!isPast || !order) return null

                    const capabilities = getStepCapabilities(step.id as string, order)

                    return (
                        <div
                            className="flex items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <StageAction
                                icon={Eye}
                                label="Ver etapa (solo lectura)"
                                active={isActive && stepMode === "view"}
                                tone="view"
                                onClick={() => onStepClick(index, "view")}
                            />

                            <StageAction
                                icon={Pencil}
                                label="Editar datos de etapa"
                                reason={capabilities.canEdit
                                    ? undefined
                                    : capabilities.editBlockedReason ?? "No se puede editar en este estado"}
                                active={isActive && stepMode === "edit-in-place"}
                                tone="info"
                                onClick={() => onStepClick(index, "edit-in-place")}
                            />

                            <StageAction
                                icon={RotateCcw}
                                label="Retroceder a esta etapa"
                                reason={capabilities.canRewind
                                    ? undefined
                                    : capabilities.rewindBlockedReason ?? "No se puede retroceder en este estado"}
                                active={isActive && stepMode === "rewind"}
                                tone="warning"
                                onClick={() => onStepClick(index, "rewind")}
                            />
                        </div>
                    )
                }}
            />
        </TooltipProvider>
    )
}