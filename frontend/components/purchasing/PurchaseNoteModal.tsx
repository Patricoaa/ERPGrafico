"use client"

import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
    ChevronRight,
    ChevronLeft,
    Check,
    Loader2,
    FileBadge,
    X
} from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { PricingUtils } from "@/lib/pricing"

// Components
import { PurchaseNoteSummarySidebar } from "./notes/PurchaseNoteSummarySidebar"
import { Step1_GeneralInfo, Step2_LineItems, Step3_Review, Step4_Payment } from "./notes/PurchaseNoteWizardSteps"
import { PaymentData } from "@/components/shared/PaymentMethodCardSelector"

interface PurchaseNoteModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId: number
    orderNumber: string
    invoiceId?: number
    onSuccess?: () => void
    initialType?: "NOTA_CREDITO" | "NOTA_DEBITO"
}

export function PurchaseNoteModal({
    open,
    onOpenChange,
    orderId,
    orderNumber,
    invoiceId,
    onSuccess,
    initialType = "NOTA_CREDITO"
}: PurchaseNoteModalProps) {
    // -- State --
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Data State
    const [noteType, setNoteType] = useState<"NOTA_CREDITO" | "NOTA_DEBITO">(initialType)
    const [documentNumber, setDocumentNumber] = useState("")
    const [attachment, setAttachment] = useState<File | null>(null)
    const [lines, setLines] = useState<any[]>([])
    const [orderDetails, setOrderDetails] = useState<any>(null)
    const [paymentData, setPaymentData] = useState<PaymentData>({
        method: null,
        amount: 0,
        treasuryAccountId: null,
        paymentMethodId: null,
        transactionNumber: '',
        isPending: false
    })

    // -- Effects --
    useEffect(() => {
        if (open) {
            // Reset state
            setStep(1)
            setDocumentNumber("")
            setAttachment(null)
            setLines([])
            setNoteType(initialType)
            fetchOrderDetails()
        }
    }, [open])

    const fetchOrderDetails = async () => {
        setLoading(true)
        try {
            const response = await api.get(`/purchasing/orders/${orderId}/`)
            setOrderDetails(response.data)

            // Initializing lines with 0 quantity but original unit cost
            const initialLines = (response.data.lines || []).map((line: any) => ({
                id: line.id,
                product: line.product,
                product_name: line.product_name,
                product_code: line.product_code,
                uom_name: line.uom_name,
                quantity: line.quantity, // Original qty
                unit_cost: parseFloat(line.unit_cost),

                // Editable fields for note
                note_quantity: 0,
                note_unit_cost: parseFloat(line.unit_cost)
            }))
            setLines(initialLines)
        } catch (error) {
            console.error("Error fetching order details:", error)
            toast.error("No se pudieron cargar los detalles de la orden")
        } finally {
            setLoading(false)
        }
    }

    // -- Calculations --
    const amountNet = lines.reduce((acc, line) => acc + (line.note_quantity * line.note_unit_cost), 0)
    // Assuming simple tax calc for now - could be enhanced based on product tax type if needed
    const amountTax = PricingUtils.calculateTax(amountNet)
    const total = amountNet + amountTax

    useEffect(() => {
        setPaymentData(prev => ({ ...prev, amount: total }))
    }, [total])

    // -- Handlers --
    const validateStep = (currentStep: number): boolean => {
        if (currentStep === 1) {
            if (!documentNumber.trim()) {
                toast.error("Debe ingresar el número de folio del documento")
                return false
            }
        }
        if (currentStep === 2) {
            const hasItems = lines.some(l => l.note_quantity > 0)
            if (!hasItems) {
                toast.error("Debe seleccionar al menos un producto (cantidad > 0)")
                return false
            }
            if (amountNet <= 0) {
                toast.error("El monto total debe ser mayor a 0")
                return false
            }
        }
        return true
    }

    const handleNext = () => {
        if (validateStep(step)) {
            setStep(prev => prev + 1)
        }
    }

    const handleBack = () => {
        setStep(prev => prev - 1)
    }

    const handleSubmit = async () => {
        setSubmitting(true)
        try {
            const formData = new FormData()
            formData.append('note_type', noteType)
            formData.append('document_number', documentNumber)
            formData.append('amount_net', amountNet.toString())
            formData.append('amount_tax', amountTax.toString())

            const returnItems = lines
                .filter(l => l.note_quantity > 0)
                .map(l => ({
                    product_id: l.product,
                    quantity: l.note_quantity,
                    unit_cost: l.note_unit_cost
                }))

            formData.append('return_items', JSON.stringify(returnItems))

            if (invoiceId) {
                formData.append('original_invoice_id', invoiceId.toString())
            }

            if (attachment) {
                formData.append('document_attachment', attachment)
            }

            if (paymentData.method || paymentData.amount > 0) {
                formData.append('payment_data', JSON.stringify(paymentData))
            }

            await api.post(`/purchasing/orders/${orderId}/register_note/`, formData)

            toast.success("Nota registrada correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: any) {
            console.error("Error registering note:", error)
            toast.error(error.response?.data?.error || "Error al registrar la nota")
        } finally {
            setSubmitting(false)
        }
    }

    // -- Render --
    const totalSteps = 4

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
                    <div className={`p-3 rounded-2xl ${noteType === 'NOTA_CREDITO' ? 'bg-amber-100' : 'bg-blue-100'}`}>
                        <FileBadge className={`h-6 w-6 ${noteType === 'NOTA_CREDITO' ? 'text-amber-600' : 'text-blue-600'}`} />
                    </div>
                    <div>
                        <span className="font-black tracking-tighter uppercase block text-lg">
                            Registrar {noteType === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            <span>Ref: OCS-{orderNumber}</span>
                        </div>
                    </div>
                </div>
            }
            footer={
                <div className="w-full flex justify-between items-center">
                    <Button
                        variant="ghost"
                        onClick={handleBack}
                        disabled={step === 1 || submitting}
                        className="h-12 px-6 font-bold text-muted-foreground hover:text-foreground"
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Atrás
                    </Button>

                    <div className="flex items-center gap-2">
                        <Button
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                            disabled={submitting}
                            className="h-12 px-6 font-bold text-muted-foreground"
                        >
                            Cancelar
                        </Button>

                        {step < totalSteps ? (
                            <Button
                                onClick={handleNext}
                                className="w-40 h-12 font-bold bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                            >
                                Siguiente
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleSubmit}
                                className={`w-48 h-12 font-bold shadow-lg hover:shadow-xl transition-all ${noteType === 'NOTA_CREDITO'
                                    ? 'bg-amber-600 hover:bg-amber-700'
                                    : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                                disabled={submitting}
                            >
                                {submitting ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="mr-2 h-4 w-4" />
                                )}
                                Confirmar Registro
                            </Button>
                        )}
                    </div>
                </div>
            }
        >
            <div className="flex flex-1 overflow-hidden h-full">
                {/* Left Sidebar - Summary */}
                <PurchaseNoteSummarySidebar
                    currentStep={step}
                    totalSteps={totalSteps}
                    orderNumber={orderNumber}
                    supplierName={orderDetails?.supplier_name}
                    warehouseName={orderDetails?.warehouse_name}
                    noteType={noteType}
                    totals={{
                        net: amountNet,
                        tax: amountTax,
                        total: total
                    }}
                    isProcessing={submitting}
                />

                {/* Main Content */}
                <div className="flex-1 flex flex-col min-w-0 bg-muted/5">
                    <div className="flex-1 p-8 overflow-y-auto">
                        <div className="max-w-5xl mx-auto">
                            {loading ? (
                                <div className="h-64 flex flex-col items-center justify-center gap-4 text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin" />
                                    <p>Cargando información de la orden...</p>
                                </div>
                            ) : (
                                <>
                                    {step === 1 && (
                                        <Step1_GeneralInfo
                                            noteType={noteType}
                                            setNoteType={setNoteType}
                                            documentNumber={documentNumber}
                                            setDocumentNumber={setDocumentNumber}
                                            attachment={attachment}
                                            setAttachment={setAttachment}
                                        />
                                    )}
                                    {step === 2 && (
                                        <Step2_LineItems
                                            lines={lines}
                                            setLines={setLines}
                                            noteType={noteType}
                                        />
                                    )}
                                    {step === 3 && (
                                        <Step3_Review
                                            noteType={noteType}
                                            documentNumber={documentNumber}
                                            attachment={attachment}
                                            lines={lines}
                                            totals={{
                                                net: amountNet,
                                                tax: amountTax,
                                                total: total
                                            }}
                                        />
                                    )}
                                    {step === 4 && (
                                        <Step4_Payment
                                            noteType={noteType}
                                            total={total}
                                            paymentData={paymentData}
                                            setPaymentData={setPaymentData}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </BaseModal>
    )
}
