"use client"

import { Check } from "lucide-react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { type ReactNode, type RefObject, useEffect, useRef } from "react"

export type WizardStepStatus = "active" | "past" | "future" | "current"

export interface WizardSidebarStep {
    id: string | number
    label: string
    icon: LucideIcon
    detail?: ReactNode
    badge?: ReactNode
    status?: WizardStepStatus
    disabled?: boolean
    className?: string
}

export interface WizardStepsSidebarProps {
    title: string
    currentStep: number
    steps: WizardSidebarStep[]
    className?: string
    width?: string
    onStepClick?: (index: number) => void
    renderStepActions?: (step: WizardSidebarStep, index: number) => ReactNode
    showNumbers?: boolean
    detailVisibility?: "both" | "active" | "past" | "none"
    showCounter?: boolean
    density?: "compact" | "comfortable"
}

export function WizardStepsSidebar({
    title,
    currentStep,
    steps,
    className,
    width = "w-64",
    onStepClick,
    renderStepActions,
    showNumbers = true,
    detailVisibility = "both",
    showCounter = true,
    density = "compact",
}: WizardStepsSidebarProps) {
    const railRef = useRef<HTMLDivElement>(null)
    const activeStepIndex = currentStep - 1

    // Auto-scroll to active step when it changes
    useEffect(() => {
        const rail = railRef.current
        if (!rail) return
        const activeRow = rail.querySelector('[data-step-index="' + activeStepIndex + '"]')
        if (activeRow) {
            activeRow.scrollIntoView({ block: "nearest", behavior: "smooth" })
        }
    }, [activeStepIndex])

    const isCompact = density === "compact"
    const py = isCompact ? "py-1.5" : "py-2.5"
    const px = isCompact ? "px-2" : "px-3"
    const gap = isCompact ? "gap-2" : "gap-3"
    const iconSize = isCompact ? "h-5 w-5" : "h-5 w-5"
    const labelSize = isCompact ? "text-xs" : "text-sm"
    const detailSize = isCompact ? "text-3xs" : "text-2xs"
    const numberSize = isCompact ? "text-3xs" : "text-2xs"

    return (
        <div
            ref={railRef}
            className={cn(
                width,
                "border-r bg-transparent flex flex-col overflow-y-auto",
                "hidden md:flex",
                className
            )}
        >
            <div className="flex-shrink-0">
                <div className={cn("flex items-center justify-between mb-3 px-2", isCompact ? "pb-2" : "pb-3")}>
                    <h3 className="text-3xs font-bold uppercase tracking-loose text-muted-foreground/60">
                        {title}
                    </h3>
                    {showCounter && (
                        <span className="font-mono font-black text-primary tracking-wider text-3xs shrink-0">
                            {String(activeStepIndex + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden relative">
                {/* Vertical connector line */}
                <div
                    className={cn(
                        "absolute left-[16px] top-0 bottom-0 w-[2px] pointer-events-none",
                        "bg-gradient-to-b from-success/50 via-success/30 to-border"
                    )}
                    aria-hidden="true"
                >
                    {/* The gradient handles past/active/future visually; we don't need dynamic segments */}
                </div>

                <div className="relative z-10 space-y-1 pb-4" role="list" aria-label={title}>
                    {steps.map((step, index) => {
                        const stepNumber = index + 1
                        const Icon = step.icon
                        const explicitStatus = step.status
                        const isActive = explicitStatus === "active" || (!explicitStatus && currentStep === stepNumber)
                        const isPast = explicitStatus === "past" || (!explicitStatus && currentStep > stepNumber)
                        const isCurrent = explicitStatus === "current" || (!explicitStatus && currentStep === stepNumber && !isActive)
                        const isFuture = explicitStatus === "future" || (!explicitStatus && currentStep < stepNumber)

                        // When both explicit status and currentStep align to "active", prefer explicit
                        const effectiveStatus = explicitStatus ?? (isActive ? "active" : isPast ? "past" : isFuture ? "future" : "current")

                        const isClickable = !step.disabled && !!onStepClick
                        const showDetail = detailVisibility === "both"
                            ? (isActive || isPast)
                            : detailVisibility === "active"
                            ? isActive
                            : detailVisibility === "past"
                            ? isPast
                            : false

                        // Row classes by status
                        const rowBase = cn(
                            "relative",
                            py,
                            px,
                            "rounded-sm",
                            "transition-all duration-200",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                            isClickable && "cursor-pointer",
                            isClickable && "group", // for actions hover reveal
                            !isClickable && "cursor-not-allowed opacity-50"
                        )

                        const rowStatus = cn(
                            effectiveStatus === "past" && "bg-success/5 hover:bg-success/10 text-foreground/80",
                            effectiveStatus === "active" && "bg-accent/40 text-foreground font-medium",
                            effectiveStatus === "current" && "bg-accent/20 text-foreground border border-primary/20",
                            effectiveStatus === "future" && "text-muted-foreground",
                            step.className
                        )

                        // Node (circle) classes by status
                        const nodeSize = isCompact ? "h-5 w-5" : "h-6 w-6"
                        const nodeStatus = cn(
                            "shrink-0 flex items-center justify-center font-mono font-black",
                            numberSize,
                            effectiveStatus === "past" && "bg-success text-success-foreground border border-success/30",
                            effectiveStatus === "active" && "bg-primary text-primary-foreground shadow-sm",
                            effectiveStatus === "current" && "bg-primary/10 text-primary border-2 border-primary/30",
                            effectiveStatus === "future" && "bg-transparent text-muted-foreground/50 border border-border"
                        )

                        return (
                            <div
                                key={step.id}
                                data-step-index={index}
                                role="listitem"
                                className={cn(rowBase, rowStatus)}
                            >
                                {/* Stretched link pattern: the whole row is a button */}
                                <button
                                    type="button"
                                    onClick={isClickable ? () => onStepClick(index) : undefined}
                                    disabled={!isClickable}
                                    aria-current={isActive ? "step" : undefined}
                                    aria-disabled={!isClickable || undefined}
                                    className="absolute inset-0 z-0"
                                    aria-label={isClickable ? `${step.label}, paso ${stepNumber} de ${steps.length}` : undefined}
                                />

                                {/* Row content - above the stretched link */}
                                <div className={cn("relative z-10 flex items-start", gap)}>
                                    {/* Node column */}
                                    <div className="shrink-0 flex items-center justify-center">
                                        <span
                                            className={cn(nodeStatus, nodeSize, "rounded-full")}
                                            aria-hidden="true"
                                        >
                                            {effectiveStatus === "past" ? (
                                                <Check className="h-3 w-3" />
                                            ) : showNumbers ? (
                                                String(stepNumber).padStart(2, "0")
                                            ) : (
                                                <Icon className={cn(iconSize, "text-inherit")} aria-hidden="true" />
                                            )}
                                        </span>
                                    </div>

                                    {/* Label + detail column */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={cn("truncate font-medium", labelSize)}>
                                                {step.label}
                                            </span>
                                            {step.badge && (
                                                <span className="shrink-0">{step.badge}</span>
                                            )}
                                        </div>

                                        {showDetail && step.detail && (
                                            <div className="mt-0.5 animate-in fade-in duration-200 motion-reduce:animate-none">
                                                <div className={cn(detailSize, "text-muted-foreground/80 leading-snug")}>
                                                    {step.detail}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions column (hover-reveal, z-10 above stretched link) */}
                                    {renderStepActions && (
                                        <div
                                            className={cn(
                                                "shrink-0 hidden group-hover:flex items-center gap-0.5",
                                                isClickable && "opacity-100"
                                            )}
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {renderStepActions(step, index)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}