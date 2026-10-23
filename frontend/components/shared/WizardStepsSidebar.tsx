"use client"

import { AlertTriangle, Check } from "lucide-react"
import { type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Fragment, type ReactNode, useEffect, useId, useRef } from "react"

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
    /** Section label rendered before the first step of the group. */
    group?: string
    /** Blocker shown as a compact warning next to the label. */
    warning?: string
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
    /** 0-100. When provided, renders a progress bar and a progress-aware spine. */
    progressPercent?: number
    /** Prefix for the header counter, e.g. "Viendo". */
    counterLabel?: string
}

const clampPercent = (value: number) => Math.max(0, Math.min(100, Math.round(value)))

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
    progressPercent,
    counterLabel,
}: WizardStepsSidebarProps) {
    const railRef = useRef<HTMLDivElement>(null)
    const detailIdPrefix = useId()
    const activeStepIndex = currentStep - 1
    const hasProgress = typeof progressPercent === "number"
    const progress = hasProgress ? clampPercent(progressPercent) : 0

    // Scroll only the rail (never an ancestor drawer) and keep the active row
    // below the sticky header.
    useEffect(() => {
        const rail = railRef.current
        if (!rail) return
        const activeRow = rail.querySelector<HTMLElement>(
            '[data-step-index="' + activeStepIndex + '"]'
        )
        if (!activeRow) return
        const header = rail.querySelector<HTMLElement>("[data-rail-header]")
        const headerHeight = header?.offsetHeight ?? 0
        const railRect = rail.getBoundingClientRect()
        const rowRect = activeRow.getBoundingClientRect()
        const topBoundary = railRect.top + headerHeight + 4
        const needsScroll = rowRect.top < topBoundary || rowRect.bottom > railRect.bottom
        if (!needsScroll) return
        if (typeof rail.scrollTo !== "function") return
        const delta = rowRect.top - topBoundary
        rail.scrollTo({ top: rail.scrollTop + delta, behavior: "smooth" })
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
            <div
                data-rail-header
                className="sticky top-0 z-20 shrink-0 bg-card/95 backdrop-blur-sm"
            >
                <div className={cn("flex items-center justify-between mb-1 px-2", isCompact ? "pt-1 pb-1" : "pt-2 pb-2")}>
                    <h3 className="text-3xs font-bold uppercase tracking-loose text-muted-foreground/60">
                        {title}
                    </h3>
                    {showCounter && (
                        <span className="font-mono font-black text-primary tracking-wider text-3xs shrink-0 whitespace-nowrap">
                            {`${counterLabel ? `${counterLabel} ` : ""}${String(activeStepIndex + 1).padStart(2, "0")} / ${String(steps.length).padStart(2, "0")}`}
                        </span>
                    )}
                </div>
                {hasProgress && (
                    <div className="flex items-center gap-2 px-2 pb-2">
                        <div
                            data-testid="rail-progress"
                            role="progressbar"
                            aria-label="Progreso de la orden"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={progress}
                            className="h-1 flex-1 overflow-hidden rounded-full bg-border/60"
                        >
                            <div
                                className="h-full rounded-full bg-success transition-[width] duration-300 ease-premium motion-reduce:transition-none"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <span className="shrink-0 font-mono text-3xs font-bold tabular-nums text-muted-foreground">
                            {progress}%
                        </span>
                    </div>
                )}
            </div>

            <div className="flex-1 min-h-0 overflow-hidden relative">
                {/* Connector: progress-aware fill when progressPercent is provided. */}
                {hasProgress ? (
                    <>
                        <div
                            data-testid="step-connector"
                            className="absolute left-[17px] top-0 bottom-0 w-[2px] bg-border/60 pointer-events-none"
                            aria-hidden="true"
                        />
                        <div
                            data-testid="step-connector-fill"
                            className="absolute left-[17px] top-0 w-[2px] bg-success/60 pointer-events-none transition-[height] duration-300 ease-premium motion-reduce:transition-none"
                            style={{ height: `${progress}%` }}
                            aria-hidden="true"
                        />
                    </>
                ) : (
                    <div
                        data-testid="step-connector"
                        className={cn(
                            "absolute left-[17px] top-0 bottom-0 w-[2px] pointer-events-none",
                            "bg-gradient-to-b from-success/50 via-success/30 to-border"
                        )}
                        aria-hidden="true"
                    />
                )}

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

                        const isClickable = !step.disabled && !isFuture && !!onStepClick
                        const showDetail = detailVisibility === "both"
                            ? (isActive || isPast)
                            : detailVisibility === "active"
                            ? isActive
                            : detailVisibility === "past"
                            ? isPast
                            : false

                        const previousGroup = index > 0 ? steps[index - 1]?.group : undefined
                        const showGroup = !!step.group && step.group !== previousGroup
                        const detailId = `${detailIdPrefix}-detail-${index}`
                        const rowLabel = [
                            step.label,
                            `paso ${stepNumber} de ${steps.length}`,
                            step.warning ? `atención: ${step.warning}` : null,
                            isClickable ? null : "no disponible todavía",
                        ].filter(Boolean).join(", ")

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
                            <Fragment key={step.id}>
                                {showGroup && (
                                    <div
                                        role="presentation"
                                        data-testid={`rail-group-${step.group}`}
                                        className="pb-0.5 pl-7 pr-2 pt-2 first:pt-0"
                                    >
                                        <span className="text-3xs font-bold uppercase tracking-loose text-muted-foreground/70">
                                            {step.group}
                                        </span>
                                    </div>
                                )}
                                <div
                                    data-step-index={index}
                                    data-testid={`step-${index}`}
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
                                        aria-label={rowLabel}
                                        aria-describedby={showDetail && step.detail ? detailId : undefined}
                                        className="absolute inset-0 z-0"
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
                                            <div className="flex items-center justify-between gap-1.5">
                                                <span className={cn("truncate font-medium", labelSize)}>
                                                    {step.label}
                                                </span>
                                                {step.warning && (
                                                    <span
                                                        className="shrink-0 text-warning"
                                                        title={step.warning}
                                                    >
                                                        <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                                                    </span>
                                                )}
                                                {step.badge && (
                                                    <span className="shrink-0">{step.badge}</span>
                                                )}
                                            </div>

                                            {showDetail && step.detail && (
                                                <div
                                                    id={detailId}
                                                    className="mt-0.5 animate-in fade-in duration-200 motion-reduce:animate-none"
                                                >
                                                    <div className={cn(detailSize, "text-muted-foreground/80 leading-snug truncate")}>
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
                            </Fragment>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
