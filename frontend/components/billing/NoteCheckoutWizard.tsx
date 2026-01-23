"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import api from "@/lib/api"
import { ChevronRight, ChevronLeft, Loader2, FileText, CheckCircle2, ArrowRight, X } from "lucide-react"
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

    // Original Data
    const [originalInvoice, setOriginalInvoice] = useState<any>(null)

    // Wizard State (Accumulated Data)
    const [selectedItems, setSelectedItems] = useState<any[]>([])
    const [logisticsData, setLogisticsData] = useState<any>(null)
    const [registrationData, setRegistrationData] = useState<any>({
        document_number: '',
        document_date: new Date().toISOString().split('T')[0],
        is_pending: false,
        attachment: null
    })
    const [paymentData, setPaymentData] = useState<any>({
        method: '', // Blank means "Credit" if not selected? User wants implicit Credit.
        amount: 0,
        treasury_account_id: '',
        transaction_number: '',
        is_pending: false
    })

    // Computed Properties
    const requiresLogistics = selectedItems.some(item => {
        // Simple logic: if product tracks inventory, it might require logistics.
        // We rely on item properties passed from Step1 which should come from original invoice
        return item.track_inventory && (item.product_type !== 'MANUFACTURABLE' || (item.product_type === 'MANUFACTURABLE' && item.has_bom && !item.requires_advanced_manufacturing))
    })

    const totalNet = selectedItems.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0)
    const totalTax = selectedItems.reduce((acc, item) => acc + (item.quantity * item.tax_amount), 0)
    const total = totalNet + totalTax

    // Reset state on open
    useEffect(() => {
        if (open) {
            initWizard()
        } else {
            // Optional: reset state on close
        }
    }, [open])

    const initWizard = async () => {
        try {
            setInitializing(true)
            setStep(1)
            setSelectedItems([])
            setLogisticsData(null)
            setRegistrationData({
                document_number: '',
                document_date: new Date().toISOString().split('T')[0],
                is_pending: false,
                attachment: null
            })
            setPaymentData({
                method: '',
                amount: 0,
                treasury_account_id: '',
                transaction_number: '',
                is_pending: false
            })

            const invRes = await api.get(`/billing/invoices/${invoiceId}/`)
            setOriginalInvoice(invRes.data)

            // Initial Payment Amount default
            setPaymentData((p: any) => ({ ...p, amount: invRes.data.total })) // Correct logic will happen when items are selected

        } catch (error: any) {
            console.error("Error initializing note wizard:", error)
            toast.error("Error al cargar datos de la factura original.")
            onOpenChange(false)
        } finally {
            setInitializing(false)
        }
    }

    // Update payment amount when totals change
    useEffect(() => {
        setPaymentData((prev: any) => ({ ...prev, amount: total }))
    }, [total])


    const handleNext = () => {
        // Validations per step
        if (step === 1) {
            if (selectedItems.length === 0) {
                toast.error("Seleccione al menos un ítem.")
                return
            }
            if (requiresLogistics) {
                setStep(2)
            } else {
                setStep(3)
            }
        }
        else if (step === 2) {
            if (!logisticsData) {
                toast.error("Complete la información de logística.")
                return
            }
            setStep(3)
        }
        else if (step === 3) {
            if (!registrationData.is_pending && initialType === 'NOTA_CREDITO' && !registrationData.attachment) {
                toast.error("El adjunto es obligatorio para NC.")
                return
            }
            if (!registrationData.document_number && !registrationData.is_pending) {
                toast.error("Ingrese el número de folio.")
                return
            }
            setStep(4)
        }
    }

    const handleBack = () => {
        if (step === 3 && !requiresLogistics) {
            setStep(1)
        } else {
            setStep(prev => prev - 1)
        }
    }

    const handleFinish = async () => {
        setLoading(true)
        try {
            const formData = new FormData()

            // Base Data
            formData.append('original_invoice_id', invoiceId.toString())
            formData.append('note_type', initialType)

            // Items
            formData.append('selected_items', JSON.stringify(selectedItems.map(i => ({
                product_id: i.product_id,
                quantity: i.quantity,
                unit_price: i.unit_price,
                tax_amount: i.tax_amount,
                reason: i.reason
            }))))

            // Logistics
            if (requiresLogistics && logisticsData) {
                formData.append('logistics_data', JSON.stringify(logisticsData))
            }

            // Registration
            const { attachment, ...regRest } = registrationData
            formData.append('registration_data', JSON.stringify(regRest))
            if (attachment) {
                formData.append('document_attachment', attachment)
            }

            // Payment
            if (paymentData.method) {
                // User explicitly selected a payment method (Refund/Payment)
                // If method is CREDIT (implicit), we effectively send nothing or handle it in backend?
                // Backend expects 'payment_data' only if we want to register it.
                // If amount > 0 and no method -> error?
                // If paymentData.amount < total, the dif is credit.
                // We send payment_data if there is an actual payment to register.
                formData.append('payment_data', JSON.stringify(paymentData))
            }

            await api.post('/billing/note-workflows/checkout/', formData)

            toast.success("Nota generada exitosamente.")
            onSuccess?.()
            onOpenChange(false)

        } catch (error: any) {
            console.error("Checkout error:", error)
            toast.error(error.response?.data?.error || "Error al finalizar el proceso.")
        } finally {
            setLoading(false)
        }
    }

    const renderStep = () => {
        if (initializing) {
            return (
                <div className="h-[400px] flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground animate-pulse">Cargando...</p>
                </div>
            )
        }

        switch (step) {
            case 1:
                return (
                    <Step1_Items
                        originalInvoice={originalInvoice}
                        selectedItems={selectedItems}
                        setSelectedItems={setSelectedItems}
                    />
                )
            case 2:
                // We need to confirm props for Step2
                return (
                    <Step2_Logistics
                        isCreditNote={initialType === 'NOTA_CREDITO'}
                        data={logisticsData}
                        setData={setLogisticsData}
                    />
                )
            case 3:
                return (
                    <Step3_Registration
                        isCreditNote={initialType === 'NOTA_CREDITO'}
                        data={registrationData}
                        setData={setRegistrationData}
                    />
                )
            case 4:
                return (
                    <Step4_Payment
                        isCreditNote={initialType === 'NOTA_CREDITO'}
                        total={total}
                        data={paymentData}
                        setData={setPaymentData}
                    />
                )
            default:
                return null
        }
    }

    const title = initialType === 'NOTA_CREDITO' ? 'Emitir Nota de Crédito' : 'Emitir Nota de Débito'
    const totalSteps = requiresLogistics ? 4 : 3
    const isLastStep = step === 4
    const isStepLoading = loading || initializing

    const getNextButtonLabel = () => {
        if (isStepLoading) return "Procesando..."
        if (isLastStep) return "Finalizar Proceso"
        if (step === 1) return requiresLogistics ? "Siguiente" : "Siguiente"
        if (step === 2) return "Siguiente"
        if (step === 3) return "Siguiente"
        return "Siguiente"
    }

    return (
        <Dialog open={open} onOpenChange={(val) => !isStepLoading && onOpenChange(val)}>
            <DialogContent className="sm:max-w-[1400px] w-[95vw] h-[90vh] overflow-hidden flex flex-col p-0 text-foreground">
                <div className="p-6 border-b flex justify-between items-center bg-background shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-2xl">
                            <FileText className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="font-black tracking-tighter uppercase">
                                {title}
                            </DialogTitle>
                            {originalInvoice && (
                                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                                    corrigiendo {originalInvoice.dte_type_display} {originalInvoice.number}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden relative">
                    {/* Left Sidebar */}
                    {!initializing && (
                        <NoteProcessSidebar
                            currentStep={step > 2 && !requiresLogistics ? step - 1 : step}
                            totalSteps={totalSteps}
                            noteType={initialType}
                            requiresLogistics={requiresLogistics}
                            itemsCount={selectedItems.length}
                            dteNumber={registrationData.document_number}
                            paymentData={paymentData}
                        />
                    )}

                    {/* Center Content */}
                    <div className="flex-1 flex flex-col min-w-0 h-full relative">
                        <div className="flex-1 p-10 overflow-y-auto bg-background custom-scrollbar">
                            <div className="max-w-4xl mx-auto">
                                {renderStep()}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t bg-background flex justify-between z-10 shrink-0">
                            <Button
                                variant="outline"
                                onClick={handleBack}
                                disabled={step === 1 || isStepLoading}
                                className="h-12 px-6 font-bold"
                            >
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Atrás
                            </Button>

                            {step < totalSteps ? (
                                <Button onClick={handleNext} className="w-40 h-12 font-bold" disabled={isStepLoading}>
                                    Siguiente
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleFinish}
                                    className="w-48 h-12 bg-emerald-600 hover:bg-emerald-700 font-bold"
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                        <CheckCircle2 className="mr-2 h-4 w-4" />
                                    )}
                                    Finalizar Proceso
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Right Sidebar */}
                    {!initializing && (
                        <div className="w-80 hidden lg:block overflow-hidden relative">
                            <NoteItemsSummary
                                items={selectedItems}
                                totalNet={totalNet}
                                totalTax={totalTax}
                                total={total}
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
