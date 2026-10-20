"use client"

import { useCallback, useRef, useState } from 'react'
import { BaseModal, FormFooter, SubmitButton, CancelButton } from '@/components/shared'
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
 * SalesCheckoutWizard — modal surface for the sales checkout.
 *
 * `SalesCheckoutWizardView` owns the step machine and exposes it imperatively
 * (`SalesCheckoutWizardViewHandle`); this wrapper mirrors that state to render
 * the modal footer navigation. Without it the modal had no way to advance,
 * because the view only renders content (the POS drives navigation from its
 * own header through the same handle).
 */
export function SalesCheckoutWizard({
    open,
    onOpenChange,
    initialDraftId,
    ...props
}: SalesCheckoutWizardProps) {
    const viewRef = useRef<SalesCheckoutWizardViewHandle>(null)
    const [step, setStep] = useState(1)
    const [totalSteps, setTotalSteps] = useState(1)
    const [submitting, setSubmitting] = useState(false)

    // The view pushes its full state on every change; we only need the step
    // counter and the loading flag to drive the footer.
    const handleStateChange = useCallback((state: CheckoutWizardState) => {
        setStep(state.step)
        setTotalSteps(viewRef.current?.totalSteps ?? 1)
        setSubmitting(state.isLoading)
    }, [])

    const isLastStep = step >= totalSteps

    const handleNext = () => {
        void viewRef.current?.goNext()
    }

    const handleFinish = async () => {
        setSubmitting(true)
        try {
            await viewRef.current?.finishCheckout()
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="full"
            hideScrollArea
            className="h-[90vh]"
            contentClassName="p-0"
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
            footer={
                <FormFooter
                    leftActions={
                        step > 1 ? (
                            <CancelButton
                                onClick={() => viewRef.current?.goBack()}
                                disabled={submitting}
                            >
                                <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
                                Atrás
                            </CancelButton>
                        ) : undefined
                    }
                    actions={
                        isLastStep ? (
                            <SubmitButton
                                onClick={handleFinish}
                                loading={submitting}
                                className="w-48 bg-success hover:bg-success/90 text-success-foreground font-bold transition-all shadow-elevated shadow-success/20"
                                icon={Check}
                            >
                                Finalizar Venta
                            </SubmitButton>
                        ) : (
                            <SubmitButton
                                onClick={handleNext}
                                loading={submitting}
                                className="w-40"
                            >
                                Siguiente
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </SubmitButton>
                        )
                    }
                />
            }
        >
            <SalesCheckoutWizardView
                {...props}
                ref={viewRef}
                initialDraftId={initialDraftId}
                onCancel={() => onOpenChange(false)}
                isInline={false}
                onStateChange={handleStateChange}
            />
        </BaseModal>
    )
}

export default SalesCheckoutWizard
