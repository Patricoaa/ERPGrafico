"use client"

import React from "react"
import { BaseModal, type BaseModalProps } from "./BaseModal"
import { Drawer } from "./Drawer"
import { ActionSlideButton } from "./ActionSlideButton"
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
    surface?: "modal" | "drawer"
    drawerSide?: "top" | "right" | "bottom" | "left"
    drawerBoundary?: "screen" | "embedded"
}

/**
 * GenericWizard
 *
 * Industrial-themed multi-step wizard built on BaseModal or Drawer.
 * Uses ActionSlideButton for primary navigation (matching the kinetic interaction contract).
 * Includes a monospaced industrial step counter for prepress-style progress indication.
 */
export function GenericWizard({
    open,
    onOpenChange,
    title,
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
    ...props
}: GenericWizardProps) {
    const [currentStep, setCurrentStep] = React.useState(initialStep)
    const [isStepTransitioning, startTransition] = React.useTransition()
    const [isFinished, setIsFinished] = React.useState(false)
    const prevOpen = React.useRef(open)

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

    // Notify parent of the active step (drives external shortcuts / tracking)
    React.useEffect(() => {
        onStepChange?.(currentStep)
    }, [currentStep, onStepChange])

    const totalSteps = steps.length
    const currentStepData = steps[currentStep]
    const isFirstStep = currentStep === 0
    const isLastStep = currentStep === totalSteps - 1

    const handleNext = async () => {
        if (currentStepData.onNext) {
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
    }

    const handleBack = () => {
        if (!isFirstStep) {
            setCurrentStep(prev => prev - 1)
        }
    }

    // Industrial step indicator: "01 / 03 — Título del Paso"
    const stepDescription = (
        <div className={cn("flex items-center gap-3", touchMode && "gap-4")}>
            <span className={cn(
                "font-mono font-black text-primary tracking-wider",
                touchMode ? "text-sm" : "text-xs"
            )}>
                {String(currentStep + 1).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
            </span>
            <span className={cn(
                "font-black uppercase tracking-wider text-muted-foreground",
                touchMode ? "text-xs" : "text-[10px]"
            )}>
                {currentStepData.title}
            </span>
        </div>
    )


    // Footer actions
    const footer = !isFinished && (
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
                    <ActionSlideButton
                        variant="success"
                        size={touchMode ? "lg" : undefined}
                        onClick={() => startTransition(handleNext)}
                        disabled={currentStepData.isValid === false || isCompleting || isStepTransitioning}
                        loading={isCompleting || isStepTransitioning}
                        icon={isCompleting || isStepTransitioning ? undefined : (completeButtonIcon ?? CheckCircle2)}
                        className={cn(touchMode && "active:scale-[0.98]")}
                    >
                        {completeButtonLabel}
                    </ActionSlideButton>
                ) : (
                    <ActionSlideButton
                        variant="primary"
                        size={touchMode ? "lg" : undefined}
                        onClick={() => startTransition(handleNext)}
                        disabled={currentStepData.isValid === false || isCompleting || isStepTransitioning}
                        loading={isStepTransitioning}
                        icon={isStepTransitioning ? undefined : ChevronRight}
                        className={cn(touchMode && "active:scale-[0.98]")}
                    >
                        Siguiente
                    </ActionSlideButton>
                )}
            </div>
        </div>
    )

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

    const contentWrapper = (
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
                currentStepData.component
            )}
        </div>
    )

    if (surface === "drawer") {
        return (
            <Drawer
                open={open}
                onOpenChange={(val) => {
                    if (!val) onClose?.()
                    onOpenChange(val)
                }}
                title={title}
                subtitle={stepDescription}
                side={drawerSide}
                boundary={drawerBoundary}
                defaultSize={drawerSize}
                footer={footer}
                contentClassName="p-6"
                {...props}
            >
                {contentWrapper}
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
            description={stepDescription}
            size={size}
            variant="wizard"
            footer={footer}
            {...props}
        >
            {contentWrapper}
        </BaseModal>
    )
}
