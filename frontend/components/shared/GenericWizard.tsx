"use client"

import React, { useState, useTransition } from "react"
import { BaseModal, BaseModalProps } from "./BaseModal"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

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
}

export function GenericWizard({
    open,
    onOpenChange,
    title,
    steps,
    onComplete,
    onClose,
    initialStep = 0,
    completeButtonLabel = "Finalizar",
    completeButtonIcon = <CheckCircle2 className="h-4 w-4" />,
    isCompleting = false,
    isLoading = false,
    successContent,
    size = "md",
    ...props
}: GenericWizardProps) {
    const [currentStep, setCurrentStep] = useState(initialStep)
    const [isStepTransitioning, startTransition] = useTransition()
    const [isFinished, setIsFinished] = useState(false)

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

    // Header dynamic description: "Paso X de Y: Titulo del Paso"
    const stepDescription = `Paso ${currentStep + 1} de ${totalSteps}: ${currentStepData.title}`

    // Footer actions
    const footer = !isFinished && (
        <div className="flex items-center justify-between w-full">
            <Button
                variant="ghost"
                onClick={handleBack}
                disabled={isFirstStep || isCompleting || isStepTransitioning}
                className="gap-2"
            >
                <ChevronLeft className="h-4 w-4" />
                Anterior
            </Button>

            <Button
                onClick={() => startTransition(handleNext)}
                disabled={currentStepData.isValid === false || isCompleting || isStepTransitioning}
                className={cn(
                    "gap-2 min-w-[120px]",
                    isLastStep && "bg-success hover:bg-success/90 text-success-foreground"
                )}
            >
                {isCompleting || isStepTransitioning ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                ) : isLastStep ? (
                    <>
                        {completeButtonLabel}
                        {completeButtonIcon}
                    </>
                ) : (
                    <>
                        Siguiente
                        <ChevronRight className="h-4 w-4" />
                    </>
                )}
            </Button>
        </div>
    )

    if (isFinished && successContent) {
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
            <div className={cn(
                "animate-in fade-in slide-in-from-right-4 duration-300",
                (isStepTransitioning || isLoading) && "opacity-50 pointer-events-none"
            )}>
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                        <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-4" />
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">Cargando datos del asistente...</p>
                    </div>
                ) : (
                    currentStepData.component
                )}
            </div>
        </BaseModal>
    )
}
