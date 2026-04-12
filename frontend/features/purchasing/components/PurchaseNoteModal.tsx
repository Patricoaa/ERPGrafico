"use client"

import { showApiError } from "@/lib/errors"
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
import { PaymentData } from "@/features/treasury/components/PaymentMethodCardSelector"
import { validateTaxPeriod } from "@/lib/actions/tax-actions"

import { ShieldAlert } from "lucide-react"

// Components
import { PurchaseNoteSummarySidebar } from "./notes/PurchaseNoteSummarySidebar"
import { Step1_GeneralInfo, Step2_LineItems, Step3_Review, Step4_Payment } from "./notes/PurchaseNoteWizardSteps"
import { PaymentData } from "@/features/treasury/components/PaymentMethodCardSelector"

interface PurchaseNoteModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    orderId?: number
    orderNumber?: string
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
    const [documentDate, setDocumentDate] = useState<Date | undefined>(new Date())
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
    const [isFolioValid, setIsFolioValid] = useState(true)

    const [isPeriodValid, setIsPeriodValid] = useState(true)

    // -- Effects --
    useEffect(() => {
        if (open) {
            // Reset state
            setStep(1)
            setDocumentNumber("")
            setDocumentDate(new Date())
            setAttachment(null)
            setLines([])
            setNoteType(initialType)
            fetchDetails()
        }
    }, [open])

    const fetchDetails = async () => {
        setLoading(true)
        try {
            let data: any = {}
            let fetchedLines: any[] = []

            if (orderId) {
                const response = await api.get(`/purchasing/orders/${orderId}/`)
                data = response.data
                fetchedLines = data.lines || []
            } else if (invoiceId) {
                const response = await api.get(`/billing/invoices/${invoiceId}/`)
                data = response.data
                // Map invoice lines to expected structure
                fetchedLines = (data.lines || []).map((l: any) => ({
                    ...l,
                    // If invoice lines differ, map them here. Assuming similar structure:
                    // product, quantity, unit_price/unit_cost
                    unit_cost: l.unit_price || l.unit_cost // Invoice usually has unit_price
                }))
            }

            setOrderDetails(data)

            // Initializing lines with 0 quantity but original unit cost
            const initialLines = fetchedLines.map((line: any) => ({
                id: line.id,
                product: line.product,
                product_name: line.product_name || line.description, // Fallback
                product_code: line.product_code,
                uom_name: line.uom_name,
                quantity: line.quantity, // Original qty
                unit_cost: parseFloat(line.unit_cost || line.unit_price || 0),

                // Editable fields for note
                note_quantity: 0,
                note_unit_cost: parseFloat(line.unit_cost || line.unit_price || 0)
            }))
            setLines(initialLines)
        } catch (error) {
            console.error("Error fetching details:", error)
            toast.error("No se pudieron cargar los detalles del documento")
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
            if (!documentDate) {
                toast.error("Debe seleccionar la fecha de emisión")
                return false
            }
            if (!attachment) {
                toast.error("El documento adjunto es obligatorio para este tipo de nota")
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

    const handleNext = async () => {
        if (validateStep(step)) {
            // Live validation already handles this, but as a secondary check/guard
            if (!isPeriodValid) {
                toast.error("El periodo seleccionado está cerrado. No puede continuar.")
                return
            }

            if (step === 1 && !isFolioValid) {
                toast.error("El número de folio ya ha sido utilizado para este proveedor. Ingrese uno válido para continuar.")
                return
            }

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
            if (documentDate) {
                formData.append('document_date', documentDate.toISOString().split('T')[0])
            }
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

            let endpoint = ""
            if (orderId) {
                endpoint = `/purchasing/orders/${orderId}/register_note/`
            } else if (invoiceId) {
                // Standalone invoice note
                endpoint = `/billing/invoices/${invoiceId}/register_note/`
            } else {
                throw new Error("No Order ID or Invoice ID provided")
            }

            await api.post(endpoint, formData)

            toast.success("Nota registrada correctamente")
            onOpenChange(false)
            onSuccess?.()
        } catch (error: unknown) {
            console.error("Error registering note:", error)
            showApiError(error, "Error al registrar la nota")
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
                    <div className={`p-3 rounded-lg ${noteType === 'NOTA_CREDITO' ? 'bg-warning/10' : 'bg-primary/10'}`}>
                        <FileBadge className={`h-6 w-6 ${noteType === 'NOTA_CREDITO' ? 'text-warning' : 'text-primary'}`} />
                    </div>
                    <div>
                        <span className="font-black tracking-tighter uppercase block text-lg">
                            Registrar {noteType === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'}
                        </span>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                            {orderNumber ? (
                                <span>Ref: OCS-{orderNumber}</span>
                            ) : orderDetails?.number ? (
                                <span>Ref: DOC-{orderDetails.number}</span>
                            ) : (
                                <span>Ref: Documento #{invoiceId}</span>
                            )}
                        </div>
                    </div>
                </div>
            }
            footer={
                <div className="w-full flex justify-between items-center">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={step === 1 || submitting}
                        className="h-12 px-6 font-bold"
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Atrás
                    </Button>

                    {step < totalSteps ? (
                        <Button
                            onClick={handleNext}
                            disabled={step === 1 && (isClosed || periodValidating || !documentNumber || !attachment || !isFolioValid)}
                            className="w-40 h-12 font-bold bg-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all"
                        >
                            Siguiente
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleSubmit}
                            className={`w-48 h-12 font-bold shadow-lg hover:shadow-xl transition-all ${noteType === 'NOTA_CREDITO'
                                ? 'bg-warning hover:bg-warning'
                                : 'bg-primary hover:bg-primary'
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
            }
        >
            <div className="flex flex-1 overflow-hidden h-full">
                {/* Left Sidebar - Summary */}
                <PurchaseNoteSummarySidebar
                    currentStep={step}
                    totalSteps={totalSteps}
                    orderNumber={orderNumber}
                    referenceText={orderNumber ? undefined : (orderDetails?.number ? `Sobre DOC-${orderDetails.number}` : `Sobre Documento #${invoiceId}`)}
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
                                            documentNumber={reference}
                                            setDocumentNumber={setReference}
                                            documentDate={documentDate}
                                            setDocumentDate={setDocumentDate}
                                            attachment={attachment}
                                            setAttachment={setAttachment}
                                            contactId={orderDetails?.supplier}
                                            onValidityChange={(isValid) => setIsFolioValid(isValid)}
                                            onPeriodValidityChange={(isValid) => setIsPeriodValid(isValid)}
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
