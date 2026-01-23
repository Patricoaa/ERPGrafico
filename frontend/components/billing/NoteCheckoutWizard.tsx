"use client"

import { useState, useEffect, useRef } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import api from "@/lib/api"
import { Check, ChevronRight, ChevronLeft, Loader2, FileText, Package, Truck, Wallet, CheckCircle2, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

// Sub-components
import { Step1_Items } from "@/components/billing/checkout/Step1_Items"
import { Step2_Logistics } from "@/components/billing/checkout/Step2_Logistics"
import { Step3_Registration } from "@/components/billing/checkout/Step3_Registration"
import { Step4_Payment } from "@/components/billing/checkout/Step4_Payment"
import { NoteProcessSidebar } from "@/components/billing/checkout/NoteProcessSidebar"
import { NoteItemsSummary } from "@/components/billing/checkout/NoteItemsSummary"

interface NoteCheckoutWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: number
    invoiceId: number // Original invoice being corrected
    initialType: 'NOTA_CREDITO' | 'NOTA_DEBITO'
    onSuccess?: () => void
}

export function NoteCheckoutWizard({
    open,
    onOpenChange,
    orderId,
    invoiceId,
    initialType,
    onSuccess
}: NoteCheckoutWizardProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [initializing, setInitializing] = useState(true)
    const [workflow, setWorkflow] = useState<any>(null)
    const [originalInvoice, setOriginalInvoice] = useState<any>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const stepRef = useRef<any>(null)

    // Initial load: Initialize workflow
    useEffect(() => {
        if (open && !workflow) {
            initWorkflow()
        }
    }, [open])

    const initWorkflow = async () => {
        try {
            setInitializing(true)
            // 1. Fetch original invoice details for display
            const invRes = await api.get(`/billing/invoices/${invoiceId}/`)
            setOriginalInvoice(invRes.data)

            // 2. Initialize workflow on backend
            const res = await api.post("/billing/note-workflows/init/", {
                corrected_invoice_id: invoiceId,
                note_type: initialType,
                reason: `Corrección de ${invRes.data.dte_type_display || 'factura'} ${invRes.data.number || 'Draft'}`
            })
            setWorkflow(res.data)
            setStep(1) // Step 1: Select items
        } catch (error: any) {
            console.error("Error initializing note workflow:", error)
            toast.error(error.response?.data?.error || "Error al iniciar el proceso de nota.")
            onOpenChange(false)
        } finally {
            setInitializing(false)
        }
    }

    const handleNext = async () => {
        if (stepRef.current?.submit) {
            setIsSubmitting(true)
            try {
                await stepRef.current.submit()
            } catch (error) {
                console.error("Wizard submit error:", error)
            } finally {
                setIsSubmitting(false)
            }
        }
    }

    const handleBack = () => {
        if (step > 1) {
            if (step === 3 && !workflow.requires_logistics) {
                setStep(1)
            } else {
                setStep(prev => prev - 1)
            }
        }
    }

    const onComplete = () => {
        toast.success(`Proceso finalizado exitosamente.`)
        onSuccess?.()
        onOpenChange(false)
    }

    const renderStep = () => {
        if (initializing) {
            return (
                <div className="h-[400px] flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground animate-pulse">
                        Iniciando flujo de nota...
                    </p>
                </div>
            )
        }

        switch (step) {
            case 1:
                return (
                    <Step1_Items
                        ref={stepRef}
                        workflow={workflow}
                        originalInvoice={originalInvoice}
                        onSuccess={(updatedWorkflow: any) => {
                            setWorkflow(updatedWorkflow)
                            setStep(updatedWorkflow.requires_logistics ? 2 : 3)
                        }}
                    />
                )
            case 2:
                return (
                    <Step2_Logistics
                        ref={stepRef}
                        workflow={workflow}
                        onSuccess={(updatedWorkflow: any) => {
                            setWorkflow(updatedWorkflow)
                            setStep(3)
                        }}
                    />
                )
            case 3:
                return (
                    <Step3_Registration
                        ref={stepRef}
                        workflow={workflow}
                        onSuccess={(updatedWorkflow: any) => {
                            setWorkflow(updatedWorkflow)
                            setStep(4)
                        }}
                    />
                )
            case 4:
                return (
                    <Step4_Payment
                        ref={stepRef}
                        workflow={workflow}
                        onSuccess={(updatedWorkflow: any) => {
                            setWorkflow(updatedWorkflow)
                            onComplete()
                        }}
                    />
                )
            default:
                return null
        }
    }

    const title = initialType === 'NOTA_CREDITO' ? 'Emitir Nota de Crédito' : 'Emitir Nota de Débito'
    const totalSteps = workflow?.requires_logistics ? 4 : 3
    const isLastStep = step === 4
    const isStepLoading = isSubmitting || initializing || loading

    const getNextButtonLabel = () => {
        if (isStepLoading) return "Procesando..."
        if (isLastStep) return "Finalizar Proceso"
        if (step === 1) return workflow?.requires_logistics ? "Continuar a Logística" : "Continuar a Documento"
        if (step === 2) return "Procesar Logística"
        if (step === 3) return "Continuar a Pago"
        return "Continuar"
    }

    return (
        <Dialog open={open} onOpenChange={(val) => !isStepLoading && onOpenChange(val)}>
            <DialogContent className="sm:max-w-[1400px] w-[95vw] min-h-[85vh] max-h-[90vh] overflow-hidden flex flex-col p-0 text-foreground">
                <div className="p-6 border-b flex justify-between items-center bg-muted/30 shrink-0">
                    <div>
                        <DialogTitle className="text-2xl flex items-center gap-2">
                            <FileText className="h-6 w-6 text-primary" />
                            {title}
                            {originalInvoice && (
                                <span className="text-sm font-normal text-muted-foreground ml-2">
                                    corrigiendo {originalInvoice.dte_type_display} {originalInvoice.number}
                                </span>
                            )}
                        </DialogTitle>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Process tracking */}
                    {!initializing && (
                        <NoteProcessSidebar
                            currentStep={step > 2 && !workflow.requires_logistics ? step - 1 : step}
                            totalSteps={totalSteps}
                            noteType={initialType}
                            requiresLogistics={workflow?.requires_logistics}
                            itemsCount={workflow?.selected_items?.length || 0}
                            dteNumber={workflow?.invoice?.number}
                        />
                    )}

                    {/* Center - Content Area Wrapper */}
                    <div className="flex-1 flex flex-col min-w-0 h-full relative">
                        {/* Scrollable Content */}
                        <div className="flex-1 p-8 overflow-y-auto bg-background pb-32">
                            {renderStep()}
                        </div>

                        {/* Fixed Footer */}
                        <div className="absolute bottom-0 left-0 right-0 p-6 border-t bg-background/80 backdrop-blur-md flex justify-between z-20 shrink-0">
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                disabled={step === 1 || isStepLoading || initializing}
                                className="h-12 px-6 font-bold"
                            >
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Atrás
                            </Button>

                            <Button
                                onClick={handleNext}
                                disabled={isStepLoading}
                                className={cn(
                                    "group px-10 py-7 rounded-2xl font-black text-base transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl",
                                    isLastStep ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-primary text-primary-foreground"
                                )}
                            >
                                {isStepLoading ? (
                                    <>
                                        <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                        {getNextButtonLabel()}
                                    </>
                                ) : (
                                    <>
                                        {getNextButtonLabel()}
                                        {isLastStep ? (
                                            <CheckCircle2 className="ml-3 h-5 w-5 transition-transform group-hover:scale-110" />
                                        ) : (
                                            <ArrowRight className="ml-3 h-5 w-5 transition-transform group-hover:translate-x-1" />
                                        )}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Right Sidebar - Items Summary */}
                    {!initializing && (
                        <div className="w-80 border-l hidden lg:block overflow-y-auto bg-muted/5">
                            <NoteItemsSummary
                                items={workflow?.selected_items || []}
                                totalNet={workflow?.total_net || 0}
                                totalTax={workflow?.total_tax || 0}
                                total={workflow?.total || 0}
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
