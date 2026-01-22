"use client"

import { useState, useEffect } from "react"
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
import { Check, ChevronRight, ChevronLeft, Loader2, FileText, Package, Truck, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"

// Sub-components
import { Step1_Items } from "./checkout/Step1_Items"
import { Step2_Logistics } from "./checkout/Step2_Logistics"
import { Step3_Registration } from "./checkout/Step3_Registration"
import { Step4_Completion } from "./checkout/Step4_Completion"
import { NoteSummarySidebar } from "./checkout/NoteSummarySidebar"

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
        if (step === 4) {
            onOpenChange(false)
            onSuccess?.()
            return
        }

        // Logical progression is handled by each step calling the backend
        // This function will be triggered by child components after successful API call
        setStep(prev => prev + 1)
    }

    const handleBack = () => {
        if (step > 1) setStep(prev => prev - 1)
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
                        workflow={workflow}
                        onSuccess={(updatedWorkflow: any) => {
                            setWorkflow(updatedWorkflow)
                            handleNext()
                        }}
                        onSkip={() => setStep(3)}
                    />
                )
            case 3:
                return (
                    <Step3_Registration
                        workflow={workflow}
                        onSuccess={(updatedWorkflow: any) => {
                            setWorkflow(updatedWorkflow)
                            handleNext()
                        }}
                    />
                )
            case 4:
                return (
                    <Step4_Completion
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

    const onComplete = () => {
        toast.success(`${workflow.invoice.dte_type_display} procesada exitosamente.`)
        onSuccess?.()
        onOpenChange(false)
    }

    const title = initialType === 'NOTA_CREDITO' ? 'Emitir Nota de Crédito' : 'Emitir Nota de Débito'

    return (
        <Dialog open={open} onOpenChange={(val) => !loading && onOpenChange(val)}>
            <DialogContent className="max-w-5xl p-0 overflow-hidden flex flex-col h-[90vh] sm:h-[800px]">
                <DialogHeader className="p-6 border-b shrink-0">
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <FileText className="h-5 w-5 text-primary" />
                        {title}
                        {originalInvoice && (
                            <span className="text-sm font-normal text-muted-foreground ml-2">
                                corrigiendo {originalInvoice.dte_type_display} {originalInvoice.number}
                            </span>
                        )}
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 flex overflow-hidden">
                    {/* Sidebar */}
                    <NoteSummarySidebar
                        currentStep={step}
                        workflow={workflow}
                        initializing={initializing}
                    />

                    {/* Main Content Area */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-background">
                        <div className="flex-1 overflow-y-auto p-6">
                            {renderStep()}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
