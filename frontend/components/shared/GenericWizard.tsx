"use client"

import React from "react"
import { BaseModal, type BaseModalProps } from "./BaseModal"
import { Drawer } from "./Drawer"
import { SubmitButton } from "./ActionButtons"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { LoadingFallback } from "./LoadingFallback"

export interface WizardStep {
    id: string | number
    title: string
    description?: string
    component: React.ReactNode
    isValid?: boolean
    onNext?: () => Promise<boolean | void>
}

/**
 * Context handed to render-prop slots (`leftSidebar`, `rightSidebar`, `footer`).
 * Lets sidebars and custom footers react to navigation without the parent
 * having to mirror the wizard's internal step state.
 */
export interface WizardRenderContext {
    /** Current step, 0-based */
    step: number
    /** Total number of steps */
    totalSteps: number
    isFirstStep: boolean
    isLastStep: boolean
    goNext: () => Promise<void>
    goBack: () => void
    goTo: (index: number) => void
}

export type WizardSlot = React.ReactNode | ((ctx: WizardRenderContext) => React.ReactNode)

/** Imperative handle exposed by `GenericWizard` for external navigation (e.g. a POS header). */
export interface GenericWizardHandle {
    goNext: () => Promise<void>
    goBack: () => void
    goTo: (index: number) => void
    finish: () => Promise<void>
    step: number
    totalSteps: number
}

export interface GenericWizardProps extends Omit<BaseModalProps, "children" | "title" | "description" | "footer"> {
    title: string | React.ReactNode
    steps: WizardStep[]
    onComplete: () => Promise<void>
    onClose?: () => void
    initialStep?: number
    /** Fired whenever the active step index changes (navigation, resets, external jumps) */
    onStepChange?: (index: number) => void
    completeButtonLabel?: string
    completeButtonIcon?: React.ReactNode
    isCompleting?: boolean
    isLoading?: boolean
    successContent?: React.ReactNode
    /** Optional footer-left element (e.g. "Suspender" button) */
    footerLeft?: React.ReactNode
    /**
     * Touch-optimized layout: larger step counter, larger tap targets in the
     * footer (h-12 buttons, bigger icons) and extra content padding.
     * Intended for touch-first surfaces such as POS open/close flows.
     */
    touchMode?: boolean

    /** Surface layout. Default: "modal" */
    surface?: "modal" | "drawer" | "inline"
    drawerSide?: "top" | "right" | "bottom" | "left"
    drawerBoundary?: "screen" | "embedded"

    /**
     * Optional override for the header subtitle. When omitted the industrial
     * step counter ("01 / 03 — Título") is used.
     */
    subtitle?: React.ReactNode

    /** Slot rendered to the left of the step content (hidden below md) */
    leftSidebar?: WizardSlot
    /** Slot rendered to the right of the step content (hidden below lg) */
    rightSidebar?: WizardSlot
    /** Width class for the left slot. Defaults to 'w-64' */
    leftSidebarWidth?: string
    /** Width class for the right slot. Defaults to 'w-80' */
    rightSidebarWidth?: string
    /**
     * Replaces the default navigation footer. Pass `null` to render no footer
     * (useful for inline surfaces whose navigation lives outside the wizard).
     */
    footer?: WizardSlot | null
    /** Extra classes for the step content scroll container */
    contentClassName?: string
    /** Extra classes for the center column wrapper */
    bodyClassName?: string

    /** Imperative navigation handle */
    handleRef?: React.Ref<GenericWizardHandle>
}

function renderSlot(slot: WizardSlot | undefined | null, ctx: WizardRenderContext): React.ReactNode {
    if (slot === undefined || slot === null) return null
    if (typeof slot === "function") return (slot as (c: WizardRenderContext) => React.ReactNode)(ctx)
    return slot
}

/**
 * GenericWizard
 *
 * Industrial-themed multi-step wizard built on BaseModal, Drawer or a bare
 * inline layout. Uses SubmitButton for primary navigation (Capa 2 action
 * button, ADR-0088). Includes a monospaced industrial step counter for
 * prepress-style progress indication.
 *
 * Layouts:
 * - `surface="modal"`  → BaseModal wrapper (default)
 * - `surface="drawer"` → Drawer wrapper from the requested edge
 * - `surface="inline"` → no chrome; the caller renders header/footer
 *
 * Optional `leftSidebar` / `rightSidebar` slots turn the wizard into a
 * three-column layout (process rail · step content · summary rail). When a
 * slot is present the wizard owns scrolling, so the underlying modal/drawer
 * disables its own ScrollArea.
 */
export function GenericWizard({
    open,
    onOpenChange,
    title,
    subtitle,
    steps,
    onComplete,
    onClose,
    initialStep = 0,
    onStepChange,
    completeButtonLabel = "Finalizar",
    completeButtonIcon,
    isCompleting = false,
    isLoading = false,
    successContent,
    footerLeft,
    size = "md",
    surface = "modal",
    drawerSide = "right",
    drawerBoundary = "embedded",
    touchMode = false,
    leftSidebar,
    rightSidebar,
    leftSidebarWidth = "w-64",
    rightSidebarWidth = "w-80",
    footer: footerOverride,
    contentClassName,
    bodyClassName,
    handleRef,
    ...props
}: GenericWizardProps) {
    const [currentStep, setCurrentStep] = React.useState(initialStep)
    const [isStepTransitioning, startTransition] = React.useTransition()
    const [isFinished, setIsFinished] = React.useState(false)
    const prevOpen = React.useRef(open)

    const totalSteps = steps.length
    const safeStep = totalSteps > 0 ? Math.min(Math.max(currentStep, 0), totalSteps - 1) : 0

    // Reset step when modal opens (transitions false → true)
    React.useEffect(() => {
        if (open && !prevOpen.current) {
            requestAnimationFrame(() => setCurrentStep(initialStep))
        }
        prevOpen.current = open
    }, [open, initialStep])

    // Sync internal state with prop to allow external navigation jumps
    React.useEffect(() => {
        requestAnimationFrame(() => setCurrentStep(initialStep))
    }, [initialStep])

    // Clamp when the step list shrinks dynamically (e.g. optional steps disappear)
    React.useEffect(() => {
        if (totalSteps > 0 && currentStep > totalSteps - 1) {
            requestAnimationFrame(() => setCurrentStep(totalSteps - 1))
        }
    }, [totalSteps, currentStep])

    // Notify parent of the active step (drives external shortcuts / tracking)
    React.useEffect(() => {
        onStepChange?.(safeStep)
    }, [safeStep, onStepChange])

    const currentStepData = steps[safeStep]
    const isFirstStep = safeStep === 0
    const isLastStep = safeStep === totalSteps - 1

    const handleNext = React.useCallback(async () => {
        if (currentStepData?.onNext) {
            const result = await currentStepData.onNext()
            if (result === false) return
        }

        if (isLastStep) {
            await onComplete()
            if (successContent) {
                setIsFinished(true)
            } else {
                onClose?.()
            }
        } else {
            setCurrentStep(prev => prev + 1)
        }
    }, [currentStepData, isLastStep, onComplete, onClose, successContent])

    const handleBack = React.useCallback(() => {
        setCurrentStep(prev => Math.max(prev - 1, 0))
    }, [])

    const goTo = React.useCallback((index: number) => {
        setCurrentStep(Math.min(Math.max(index, 0), Math.max(totalSteps - 1, 0)))
    }, [totalSteps])

    const ctx: WizardRenderContext = {
        step: safeStep,
        totalSteps,
        isFirstStep,
        isLastStep,
        goNext: handleNext,
        goBack: handleBack,
        goTo,
    }

    React.useImperativeHandle(handleRef, () => ({
        goNext: handleNext,
        goBack: handleBack,
        goTo,
        finish: async () => {
            if (isLastStep) await onComplete()
            else await handleNext()
        },
        step: safeStep,
        totalSteps,
    }), [handleNext, handleBack, goTo, isLastStep, onComplete, safeStep, totalSteps])

    // Industrial step indicator: "01 / 03 — Título del Paso"
    const stepDescription = (
        <div className={cn("flex items-center gap-3", touchMode && "gap-4")}>
            <span className={cn(
                "font-mono font-black text-primary tracking-wider",
                touchMode ? "text-sm" : "text-xs"
            )}>
                {String(safeStep + 1).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
            </span>
            <span className={cn(
                "font-black uppercase tracking-wider text-muted-foreground",
                touchMode ? "text-xs" : "text-3xs"
            )}>
                {currentStepData?.title}
            </span>
        </div>
    )

    const headerSubtitle = subtitle ?? stepDescription

    // Footer actions
    const defaultFooter = !isFinished && (
        <div className="flex flex-col w-full">
            {/* Navigation */}
            <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        disabled={isFirstStep || isCompleting || isStepTransitioning}
                        className={cn("gap-2", touchMode && "h-12 px-6 text-xs active:scale-[0.98]")}
                    >
                        <ChevronLeft className={cn("h-4 w-4", touchMode && "h-5 w-5")} />
                        Anterior
                    </Button>
                    {footerLeft}
                </div>

                {isLastStep ? (
                    <SubmitButton
                        onClick={() => startTransition(handleNext)}
                        disabled={currentStepData?.isValid === false || isCompleting || isStepTransitioning}
                        loading={isCompleting || isStepTransitioning}
                        icon={isCompleting || isStepTransitioning ? undefined : (completeButtonIcon ?? CheckCircle2)}
                        className={cn("bg-success hover:bg-success/90 text-success-foreground", touchMode && "h-12 px-6 text-xs active:scale-[0.98]")}
                    >
                        {completeButtonLabel}
                    </SubmitButton>
                ) : (
                    <SubmitButton
                        onClick={() => startTransition(handleNext)}
                        disabled={currentStepData?.isValid === false || isCompleting || isStepTransitioning}
                        loading={isStepTransitioning}
                        icon={isStepTransitioning ? undefined : ChevronRight}
                        className={cn(touchMode && "h-12 px-6 text-xs active:scale-[0.98]")}
                    >
                        Siguiente
                    </SubmitButton>
                )}
            </div>
        </div>
    )

    const footer = isFinished
        ? null
        : footerOverride === undefined
            ? defaultFooter
            : renderSlot(footerOverride, ctx)

    const sizeMap: Record<string, string> = {
        sm: "400px",
        md: "600px",
        lg: "800px",
        xl: "1000px",
        full: "100%"
    }

    const drawerSize = sizeMap[size as string] || "600px"

    if (isFinished && successContent) {
        if (surface === "drawer") {
            return (
                <Drawer
                    open={open}
                    onOpenChange={(val) => {
                        if (!val) onClose?.()
                        onOpenChange(val)
                    }}
                    title={title}
                    side={drawerSide}
                    boundary={drawerBoundary}
                    defaultSize={drawerSize}
                    contentClassName="p-6"
                    {...props}
                >
                    <div className="py-8">
                        {successContent}
                    </div>
                    <div className="mt-6 flex justify-end">
                        <Button
                            onClick={() => {
                                onClose?.()
                                onOpenChange(false)
                            }}
                            className={cn(touchMode && "h-12 px-6 text-xs active:scale-[0.98]")}
                        >Cerrar</Button>
                    </div>
                </Drawer>
            )
        }

        if (surface === "inline") {
            return <div className="py-8">{successContent}</div>
        }

        return (
            <BaseModal
                open={open}
                onOpenChange={(val) => {
                    if (!val) onClose?.()
                    onOpenChange(val)
                }}
                title={title}
                size={size}
                showCloseButton={true}
                {...props}
            >
                <div className="py-8">
                    {successContent}
                </div>
                <div className="mt-6 flex justify-end">
                    <Button
                        onClick={() => {
                            onClose?.()
                            onOpenChange(false)
                        }}
                        className={cn(touchMode && "h-12 px-6 text-xs active:scale-[0.98]")}
                    >Cerrar</Button>
                </div>
            </BaseModal>
        )
    }

    const hasSidebars = leftSidebar !== undefined && leftSidebar !== null
        || rightSidebar !== undefined && rightSidebar !== null

    const stepContent = (
        <div className={cn(
            "animate-in fade-in slide-in-from-right-4 duration-300",
            touchMode ? "px-2 py-2" : "px-1 py-1",
            (isStepTransitioning || isLoading) && "opacity-50 pointer-events-none"
        )}>
            {isLoading ? (
                <div className="py-20">
                    <LoadingFallback message="Cargando datos del asistente..." />
                </div>
            ) : (
                currentStepData?.component
            )}
        </div>
    )

    const withSidebars = (
        <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* Left rail */}
            {leftSidebar !== undefined && leftSidebar !== null && (
                <div className={cn("shrink-0 hidden md:block h-full overflow-hidden", leftSidebarWidth)}>
                    {renderSlot(leftSidebar, ctx)}
                </div>
            )}

            {/* Center column */}
            <div className={cn("flex-1 flex flex-col min-w-0 min-h-0", bodyClassName)}>
                <div className={cn("flex-1 overflow-y-auto p-6", contentClassName)}>
                    {stepContent}
                </div>
            </div>

            {/* Right rail */}
            {rightSidebar !== undefined && rightSidebar !== null && (
                <div className={cn("shrink-0 hidden lg:block h-full overflow-hidden", rightSidebarWidth)}>
                    {renderSlot(rightSidebar, ctx)}
                </div>
            )}
        </div>
    )

    // Inline surface: no chrome, caller owns header/footer.
    if (surface === "inline") {
        return (
            <div className={cn("flex flex-col h-full min-h-0", props.className)}>
                {hasSidebars ? withSidebars : (
                    <div className={cn("flex-1 overflow-y-auto", contentClassName)}>{stepContent}</div>
                )}
                {footer && <div className="flex-shrink-0">{footer}</div>}
            </div>
        )
    }

    if (surface === "drawer") {
        return (
            <Drawer
                open={open}
                onOpenChange={(val) => {
                    if (!val) onClose?.()
                    onOpenChange(val)
                }}
                title={title}
                subtitle={headerSubtitle}
                side={drawerSide}
                boundary={drawerBoundary}
                defaultSize={drawerSize}
                footer={footer ?? undefined}
                contentClassName={hasSidebars ? "p-0 flex flex-col" : "p-6"}
                fillContent={hasSidebars}
                {...props}
            >
                {hasSidebars ? withSidebars : stepContent}
            </Drawer>
        )
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={(val) => {
                if (!val) onClose?.()
                onOpenChange(val)
            }}
            title={title}
            description={headerSubtitle}
            size={size}
            variant="wizard"
            footer={footer ?? undefined}
            hideScrollArea={hasSidebars}
            {...props}
        >
            {hasSidebars ? withSidebars : stepContent}
        </BaseModal>
    )
}
