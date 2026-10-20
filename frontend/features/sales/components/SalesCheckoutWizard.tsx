"use client"

import { useCallback, useRef, useState } from 'react'
import {
    GenericWizard,
    CancelButton,
    FormFooter,
    SubmitButton,
    type WizardStep,
} from '@/components/shared'
import { Check, ChevronLeft, ChevronRight, ShoppingCart } from "lucide-react"
import {
    SalesCheckoutWizardView,
    type SalesCheckoutWizardViewHandle,
    type SalesCheckoutWizardViewProps,
    type CheckoutWizardState,
} from "./checkout/SalesCheckoutWizardView"

interface SalesCheckoutWizardProps extends Omit<SalesCheckoutWizardViewProps, "onCancel" | "isInline"> {
    open: boolean
    onOpenChange: (open: boolean) => void
}

/**
 * SalesCheckoutWizard — modal surface for the sales checkout, built on
 * `GenericWizard`.
 *
 * `SalesCheckoutWizardView` owns the step machine and renders its own sidebars
 * (process rail + order summary). The wizard therefore does not drive
 * navigation: it only mirrors the view's step count so its header counter is
 * accurate, and its footer delegates to the view's imperative handle. This
 * keeps a single source of truth (the view) and avoids the classic
 * double-advance that comes from two independent step machines.
 */
export function SalesCheckoutWizard({
    open,
    onOpenChange,
    initialDraftId,
    initialStep,
    ...props
}: SalesCheckoutWizardProps) {
    const viewRef = useRef<SalesCheckoutWizardViewHandle>(null)
    const [step, setStep] = useState(initialStep ?? 1)
    const [totalSteps, setTotalSteps] = useState(1)
    const [isLoading, setIsLoading] = useState(false)

    const handleStateChange = useCallback((state: CheckoutWizardState) => {
        setStep(state.step)
        setTotalSteps(viewRef.current?.totalSteps ?? 1)
        setIsLoading(state.isLoading)
    }, [])

    // Reusing the same element keeps the view mounted (state preserved) across
    // step changes — React reconciles it by position + type.
    const viewNode = (
        <SalesCheckoutWizardView
            {...props}
            ref={viewRef}
            initialDraftId={initialDraftId}
            initialStep={initialStep}
            onCancel={() => onOpenChange(false)}
            isInline={false}
            onStateChange={handleStateChange}
        />
    )

    const steps: WizardStep[] = Array.from(
        { length: Math.max(totalSteps, 1) },
        (_, i) => ({
            id: i + 1,
            title: SALES_CHECKOUT_STEP_LABELS[i] ?? `Paso ${i + 1}`,
            // Single mounted view shared by every step: only the active step's
            // node is rendered, so all entries point at the same element and the
            // view keeps its state across navigation.
            component: viewNode,
        }),
    )
    const isLastStep = step >= totalSteps

    const handleNext = () => { void viewRef.current?.goNext() }
    const handleBack = () => { viewRef.current?.goBack() }
    const handleFinish = async () => {
        setIsLoading(true)
        try {
            await viewRef.current?.finishCheckout()
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <GenericWizard
            open={open}
            onOpenChange={onOpenChange}
            onClose={() => onOpenChange(false)}
            surface="modal"
            size="full"
            title={
                <div className="flex items-center gap-4">
                    <ShoppingCart className="h-6 w-6 text-muted-foreground" />
                    <div>
                        <span className="font-black tracking-tighter uppercase block">Cerrar Venta</span>
                        {initialDraftId && (
                            <span className="text-3xs font-mono text-muted-foreground font-normal tracking-wider">
                                Borrador <span className="text-primary/80 font-bold">#{initialDraftId}</span>
                            </span>
                        )}
                    </div>
                </div>
            }
            steps={steps}
            initialStep={Math.max(step - 1, 0)}
            onComplete={handleFinish}
            completeButtonLabel="Finalizar Venta"
            isCompleting={isLoading}
            /* Navigation is owned by the view; render a footer that delegates
             * to its imperative handle so the modal has working nav. */
            footer={
                <FormFooter
                    leftActions={
                        step > 1 ? (
                            <CancelButton onClick={handleBack} disabled={isLoading}>
                                <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
                                Atrás
                            </CancelButton>
                        ) : undefined
                    }
                    actions={
                        isLastStep ? (
                            <SubmitButton
                                onClick={handleFinish}
                                loading={isLoading}
                                className="w-48 bg-success hover:bg-success/90 text-success-foreground font-bold transition-all shadow-elevated shadow-success/20"
                                icon={Check}
                            >
                                Finalizar Venta
                            </SubmitButton>
                        ) : (
                            <SubmitButton onClick={handleNext} loading={isLoading} className="w-40">
                                Siguiente
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </SubmitButton>
                        )
                    }
                />
            }
            contentClassName="p-0"
        />
    )
}

/** Human labels for the checkout steps, mirroring SalesCheckoutWizardView. */
const SALES_CHECKOUT_STEP_LABELS: Record<number, string> = {
    0: 'Cliente',
    1: 'Documento',
    2: 'Fabricación',
    3: 'Entrega',
    4: 'Pago',
}

export default SalesCheckoutWizard
