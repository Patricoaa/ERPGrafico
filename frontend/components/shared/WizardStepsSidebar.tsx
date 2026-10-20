"use client"

import { CheckCircle2 } from "lucide-react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { type ReactNode } from "react"

/**
 * Explicit visual state of a step row.
 * When omitted, the sidebar derives it from `currentStep` (1-based).
 */
export type WizardStepStatus = "active" | "past" | "future"

export interface WizardSidebarStep {
    id: string | number
    label: string
    icon: LucideIcon
    /** Optional content shown below the step row when the step is completed (past) */
    detail?: ReactNode
    /** Optional explicit status override (drives by domain logic instead of `currentStep`) */
    status?: WizardStepStatus
    /** When false the row is not clickable (no pointer cursor, no onStepClick) */
    disabled?: boolean
    /** Optional extra classes applied to the row container */
    className?: string
}

export interface WizardStepsSidebarProps {
    title: string
    /**
     * Current step, 1-based. Ignored per-step when `WizardSidebarStep.status` is provided.
     */
    currentStep: number
    steps: WizardSidebarStep[]
    className?: string
    /** Width class override. Defaults to 'w-64' */
    width?: string
    /** Called when a step row is clicked. `index` is 0-based. */
    onStepClick?: (index: number) => void
    /**
     * Extra actions rendered at the trailing edge of a step row
     * (edit / view / rewind buttons, for example).
     */
    renderStepActions?: (step: WizardSidebarStep, index: number) => ReactNode
    /** Optional content pinned below the step list */
    footer?: ReactNode
}

export function WizardStepsSidebar({
    title,
    currentStep,
    steps,
    className,
    width = "w-64",
    onStepClick,
    renderStepActions,
    footer,
}: WizardStepsSidebarProps) {
    return (
        <div className={cn(width, "border-r bg-transparent p-4 space-y-2 hidden md:flex md:flex-col overflow-y-auto", className)}>
            <h3 className="text-3xs font-bold uppercase tracking-loose text-muted-foreground/60 mb-4 px-2">
                {title}
            </h3>

            {steps.map((step, index) => {
                const stepNumber = index + 1
                const Icon = step.icon
                const isActive = (step.status ?? (currentStep === stepNumber ? "active" : currentStep > stepNumber ? "past" : "future")) === "active"
                const isPast = (step.status ?? (currentStep === stepNumber ? "active" : currentStep > stepNumber ? "past" : "future")) === "past"
                const isFuture = !isActive && !isPast

                const isClickable = !step.disabled && !!onStepClick

                return (
                    <div
                        key={step.id}
                        onClick={isClickable ? () => onStepClick(index) : undefined}
                        aria-disabled={!isClickable || undefined}
                        className={cn(
                            "rounded-sm transition-all duration-200",
                            isClickable && "cursor-pointer",
                            isActive && "bg-primary text-primary-foreground shadow-card",
                            isPast && "bg-success/10 text-success",
                            isFuture && "text-muted-foreground",
                            step.className
                        )}
                    >
                        <div className="flex items-center space-x-3 p-3">
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="text-sm font-medium flex-1">{step.label}</span>
                            {renderStepActions?.(step, index)}
                            {!renderStepActions && isPast && <CheckCircle2 className="h-4 w-4" />}
                        </div>

                        {isPast && step.detail && (
                            <div className="px-3 pb-3 pt-1 space-y-1 animate-in fade-in duration-300">
                                {step.detail}
                            </div>
                        )}
                    </div>
                )
            })}

            {footer && <div className="pt-2 mt-2 border-t border-border/40">{footer}</div>}
        </div>
    )
}
