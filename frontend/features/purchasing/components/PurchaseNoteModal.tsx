"use client"
import { toast } from "sonner"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"

import {
    ChevronRight,
    ChevronLeft,
    Check,
    FileBadge,
} from "lucide-react"
import { purchasingApi } from "../api/purchasingApi"
import { PurchaseOrderAPI, PurchaseNoteLine } from "../types"
import { PricingUtils } from '@/features/inventory/utils/pricing'
import { useServerDate } from '@/hooks/useServerDate'
import {ActionSlideButton, BaseModal, CancelButton, FormFooter, LoadingFallback, SubmitButton} from '@/components/shared'

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
    const { serverDate } = useServerDate()
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // Data State
    const [noteType, setNoteType] = useState<"NOTA_CREDITO" | "NOTA_DEBITO">(initialType)
    const [documentNumber, setDocumentNumber] = useState("")
    const [documentDate, setDocumentDate] = useState<Date | undefined>(serverDate ?? new Date())
    const [attachment, setAttachment] = useState<File | null>(null)
    const [lines, setLines] = useState<PurchaseNoteLine[]>([])
    const [orderDetails, setOrderDetails] = useState<PurchaseOrderAPI | null>(null)
    const [paymentData, setPaymentData] = useState<PaymentData>({
        method: null,
        amount: 0,
        treasuryAccountId: null,
        paymentMethodId: null,
        isPending: false
    })
    const [isFolioValid, setIsFolioValid] = useState(true)

    const [isPeriodValid, setIsPeriodValid] = useState(true)

    const fetchDetails = async () => {
        setLoading(true)
        try {
            let data: any = {}
            let fetchedLines: any[] = []

            if (orderId) {
                const orderItem = await purchasingApi.getOrder(orderId)
                data = orderItem as any
                fetchedLines = (data as any).lines || []
            } else if (invoiceId) {
                const invoiceData = await purchasingApi.getInvoice(invoiceId)
                data = invoiceData as any
                // Map invoice lines to expected structure
                fetchedLines = (data.lines || []).map((l: any) => ({
                    ...l,
                    // If invoice lines differ, map them here. Assuming similar structure:
                    // product, quantity, unit_price/unit_cost
                    unit_cost: l.unit_price || l.unit_cost // Invoice usually has unit_price
                }))
            }

            setOrderDetails(data as PurchaseOrderAPI)

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

    // -- Effects --
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => {
                // Reset state
                setStep(1)
                setDocumentNumber("")
                setDocumentDate(serverDate ?? new Date())
                setAttachment(null)
                setLines([])
                setNoteType(initialType)
                fetchDetails()
            })
        }
    }, [open])

    // -- Calculations --
    const amountNet = lines.reduce((acc, line) => acc + (line.note_quantity * line.note_unit_cost), 0)
    // Assuming simple tax calc for now - could be enhanced based on product tax type if needed
    const amountTax = PricingUtils.calculateTax(amountNet)
    const total = amountNet + amountTax

    useEffect(() => {
        requestAnimationFrame(() => {
            setPaymentData(prev => ({ ...prev, amount: total }))
        })
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

            if (orderId) {
                await purchasingApi.registerNote(orderId, formData)
            } else if (invoiceId) {
                await purchasingApi.registerInvoiceNote(invoiceId, formData)
            } else {
                throw new Error("No Order ID or Invoice ID provided")
            }

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
            variant="wizard"
            icon={FileBadge}
            title={noteType === 'NOTA_CREDITO' ? 'Registrar Nota de Crédito' : 'Registrar Nota de Débito'}
            description={
                orderNumber
                    ? `Ref: OCS-${orderNumber}`
                    : orderDetails?.number
                    ? `Ref: OCS-${orderDetails.number}`
                    : `Ref: Documento #${invoiceId}`
            }
            size="full"
            hideScrollArea
            className="h-[90vh]"
            contentClassName="p-0"
            footer={
                <FormFooter
                    leftActions={
                        step > 1 ? (
                            <CancelButton onClick={handleBack} disabled={submitting}>
                                <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
                                Atrás
                            </CancelButton>
                        ) : undefined
                    }
                    actions={
                        step < totalSteps ? (
                            <SubmitButton
                                onClick={handleNext}
                                disabled={step === 1 && (!isPeriodValid || !documentNumber || !attachment || !isFolioValid)}
                                icon={null}
                            >
                                Siguiente
                                <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                            </SubmitButton>
                        ) : (
                            <ActionSlideButton
                                onClick={handleSubmit}
                                variant={noteType === 'NOTA_CREDITO' ? 'destructive' : 'primary'}
                                loading={submitting}
                                icon={<Check className="h-3.5 w-3.5" />}
                            >
                                Confirmar Registro
                            </ActionSlideButton>
                        )
                    }
                />
            }
        >
            <div className="flex flex-1 overflow-hidden h-full">
                {/* Left Sidebar - Summary */}
                <PurchaseNoteSummarySidebar
                    currentStep={step}
                    totalSteps={totalSteps}
                    orderNumber={orderNumber}
                    referenceText={orderNumber ? undefined : (orderDetails?.number ? `Sobre OCS-${orderDetails.number}` : `Sobre Documento #${invoiceId}`)}
                    supplierName={(orderDetails as any)?.supplier_name}
                    warehouseName={(orderDetails as any)?.warehouse_name}
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
                                <div className="h-64 flex items-center justify-center">
                                    <LoadingFallback message="Cargando información del documento..." />
                                </div>
                            ) : (
                                <>
                                    {step === 1 && (
                                        <Step1_GeneralInfo
                                            noteType={noteType}
                                            setNoteType={setNoteType}
                                            documentNumber={documentNumber}
                                            setDocumentNumber={setDocumentNumber}
                                            documentDate={documentDate}
                                            setDocumentDate={setDocumentDate}
                                            attachment={attachment}
                                            setAttachment={setAttachment}
                                            contactId={typeof orderDetails?.supplier === 'object' ? (orderDetails?.supplier as any)?.id : orderDetails?.supplier as number | undefined}
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
