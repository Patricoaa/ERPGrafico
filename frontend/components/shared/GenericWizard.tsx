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
    completeButtonLabel?: string
    completeButtonIcon?: React.ReactNode
    isCompleting?: boolean
    isLoading?: boolean
    successContent?: React.ReactNode
    /** Optional footer-left element (e.g. "Suspender" button) */
    footerLeft?: React.ReactNode
    
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
        <div className="flex items-center gap-3">
            <span className="font-mono font-black text-xs text-primary tracking-wider">
                {String(currentStep + 1).padStart(2, '0')} / {String(totalSteps).padStart(2, '0')}
            </span>
            <span className="text-[10px]  font-black uppercase tracking-wider text-muted-foreground">
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
                        className="gap-2"
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                    </Button>
                    {footerLeft}
                </div>

                {isLastStep ? (
                    <ActionSlideButton
                        variant="success"
                        onClick={() => startTransition(handleNext)}
                        disabled={currentStepData.isValid === false || isCompleting || isStepTransitioning}
                        loading={isCompleting || isStepTransitioning}
                        icon={isCompleting || isStepTransitioning ? undefined : (completeButtonIcon ?? CheckCircle2)}
                    >
                        {completeButtonLabel}
                    </ActionSlideButton>
                ) : (
                    <ActionSlideButton
                        variant="primary"
                        onClick={() => startTransition(handleNext)}
                        disabled={currentStepData.isValid === false || isCompleting || isStepTransitioning}
                        loading={isStepTransitioning}
                        icon={isStepTransitioning ? undefined : ChevronRight}
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
                        <Button onClick={() => {
                            onClose?.()
                            onOpenChange(false)
                        }}>Cerrar</Button>
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
                    <Button onClick={() => {
                        onClose?.()
                        onOpenChange(false)
                    }}>Cerrar</Button>
                </div>
            </BaseModal>
        )
    }

    const contentWrapper = (
        <div className={cn(
            "animate-in fade-in slide-in-from-right-4 duration-300 px-1 py-1",
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
