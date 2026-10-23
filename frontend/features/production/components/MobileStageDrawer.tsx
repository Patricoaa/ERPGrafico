"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Check, ChevronDown } from "lucide-react"

import { Drawer } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import type { WorkOrder, WorkOrderStage, WizardStepMode } from "../types"
import { buildWorkOrderRailSteps } from "../lib/railSteps"

interface MobileStageDrawerProps {
    stages: WorkOrderStage[]
    viewingStepIndex: number
    actualStepIndex: number
    stepMode: WizardStepMode
    order: WorkOrder | null
    isCreating: boolean
    chosenOtType: "LINKED" | "NONE" | null
    onStepClick: (index: number) => void
}

const pad = (value: number) => String(value).padStart(2, "0")

/**
 * Mobile replacement for the desktop rail.
 *
 * The old `<select>` only listed labels. This drawer shows the same status board
 * as the rail: per-stage detail, blocker warnings, current/viewing markers and
 * section groups.
 */
export function MobileStageDrawer({
    stages,
    viewingStepIndex,
    actualStepIndex,
    stepMode,
    order,
    isCreating,
    chosenOtType,
    onStepClick,
}: MobileStageDrawerProps) {
    const [open, setOpen] = useState(false)

    const steps = useMemo(
        () => buildWorkOrderRailSteps({
            stages,
            viewingStepIndex,
            actualStepIndex,
            stepMode,
            order,
        }),
        [stages, viewingStepIndex, actualStepIndex, stepMode, order],
    )

    const currentStage = stages[viewingStepIndex] ?? stages[0]
    const CurrentIcon = currentStage?.icon
    const creationLocked = isCreating && chosenOtType === null

    return (
        <>
            <Button
                type="button"
                variant="outline"
                className="h-auto w-full justify-between gap-2 px-3 py-2"
                onClick={() => setOpen(true)}
            >
                <span className="flex min-w-0 items-center gap-2">
                    {CurrentIcon && <CurrentIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
                    <span className="truncate text-sm font-semibold">
                        {currentStage?.label ?? "Etapas"}
                    </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                    <span className="font-mono text-3xs font-black tabular-nums text-muted-foreground">
                        {pad(viewingStepIndex + 1)} / {pad(stages.length)}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </span>
            </Button>

            <Drawer
                open={open}
                onOpenChange={setOpen}
                title="Etapas"
                subtitle={`Viendo ${pad(viewingStepIndex + 1)} / ${pad(stages.length)}`}
                side="bottom"
                boundary="embedded"
                defaultSize="70vh"
                minSize="40vh"
                maxSize="85vh"
                resizable={false}
                fillContent
                contentClassName="min-h-0 flex flex-col"
            >
                <div role="list" aria-label="Etapas de la orden de trabajo" className="min-h-0 flex-1 overflow-y-auto p-2">
                    {steps.map((step, index) => {
                        const isViewing = index === viewingStepIndex
                        const isPast = step.status === "past"
                        const isCurrent = step.status === "current"
                        const isFuture = step.status === "future"
                        const disabled = Boolean(step.disabled) || (creationLocked && step.id !== "ORIGIN_SELECTION")
                        const previousGroup = index > 0 ? steps[index - 1]?.group : undefined
                        const showGroup = Boolean(step.group) && step.group !== previousGroup
                        const Icon = step.icon
                        const stepNumber = index + 1

                        return (
                            <div key={step.id} role="listitem">
                                {showGroup && (
                                    <div
                                        role="presentation"
                                        className="px-2 pb-1 pt-3 first:pt-0"
                                    >
                                        <span className="text-3xs font-bold uppercase tracking-loose text-muted-foreground/70">
                                            {step.group}
                                        </span>
                                    </div>
                                )}
                                <button
                                    type="button"
                                    disabled={disabled}
                                    aria-current={isViewing ? "step" : undefined}
                                    aria-label={[
                                        step.label,
                                        `paso ${stepNumber} de ${steps.length}`,
                                        step.warning ? `atención: ${step.warning}` : null,
                                        disabled ? "no disponible todavía" : null,
                                    ].filter(Boolean).join(", ")}
                                    onClick={() => {
                                        onStepClick(index)
                                        setOpen(false)
                                    }}
                                    className={cn(
                                        "flex w-full items-start gap-3 rounded-md px-2 py-2 text-left transition-colors",
                                        isViewing ? "bg-accent/40" : "hover:bg-accent/20",
                                        disabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-2xs font-black",
                                            isPast && "bg-success text-success-foreground border border-success/30",
                                            isViewing && "bg-primary text-primary-foreground shadow-sm",
                                            isCurrent && !isViewing && "bg-primary/10 text-primary border-2 border-primary/30",
                                            isFuture && "border border-border text-muted-foreground/50",
                                        )}
                                        aria-hidden="true"
                                    >
                                        {isPast ? (
                                            <Check className="h-3 w-3" />
                                        ) : (
                                            pad(stepNumber)
                                        )}
                                    </span>

                                    <span className="min-w-0 flex-1">
                                        <span className="flex items-center gap-1.5">
                                            <span className={cn("truncate text-sm", isViewing && "font-semibold")}>
                                                {step.label}
                                            </span>
                                            {step.badge ?? (isViewing && (
                                                <span className="shrink-0 rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-2xs font-semibold text-primary">
                                                    Viendo
                                                </span>
                                            ))}
                                            {step.warning && (
                                                <AlertTriangle
                                                    className="h-3.5 w-3.5 shrink-0 text-warning"
                                                    aria-hidden="true"
                                                />
                                            )}
                                        </span>

                                        {step.detail && (
                                            <span className="mt-0.5 block truncate text-2xs text-muted-foreground/80">
                                                {step.detail}
                                            </span>
                                        )}

                                        {step.warning && (
                                            <span className="mt-0.5 flex items-start gap-1 text-2xs text-warning">
                                                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
                                                <span>{step.warning}</span>
                                            </span>
                                        )}
                                    </span>

                                    <Icon className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden="true" />
                                </button>
                            </div>
                        )
                    })}
                </div>
            </Drawer>
        </>
    )
}
