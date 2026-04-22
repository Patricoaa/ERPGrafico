"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { useServerDate } from "@/hooks/useServerDate"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import api from "@/lib/api"
import { ChevronRight, ChevronLeft, Loader2, FileText, CheckCircle2, ArrowRight, X, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/utils"

// Sub-components
import { Step1_Items } from "@/features/billing/components/checkout/Step1_Items"
import { Step2_Logistics } from "@/features/billing/components/checkout/Step2_Logistics"
import { Step3_Registration } from "@/features/billing/components/checkout/Step3_Registration"
import { Step4_Payment } from "@/features/billing/components/checkout/Step4_Payment"
import { Step2_ManufacturingDetails } from "@/features/sales/components/checkout/Step2_ManufacturingDetails"
import { NoteProcessSidebar } from "@/features/billing/components/checkout/NoteProcessSidebar"
import { NoteItemsSummary } from "@/features/billing/components/checkout/NoteItemsSummary"


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
    const { dateString } = useServerDate()

    // Original Data
    const [originalInvoice, setOriginalInvoice] = useState<Record<string, unknown> | null>(null)

    // Wizard State (Accumulated Data)
    const [selectedItems, setSelectedItems] = useState<Record<string, unknown>[]>([])
    const [logisticsData, setLogisticsData] = useState<Record<string, unknown> | null>(null)
    const [registrationData, setRegistrationData] = useState<Record<string, unknown>>({
        document_number: '',
        document_date: '',
        is_pending: false,
        attachment: null
    })
    const [paymentData, setPaymentData] = useState<Record<string, unknown>>({
        method: '', // Blank means "Credit" if not selected? User wants implicit Credit.
        amount: 0,
        treasury_account_id: '',
        transaction_number: '',
        is_pending: false
    })

    const [isPeriodValid, setIsPeriodValid] = useState(true)

    // Computed Properties
    const requiresLogistics = selectedItems.some(item =>
        item.creates_stock_move ||
        item.product_type === 'MANUFACTURABLE' ||
        item.has_bom
    )

    const hasManufacturing = initialType === 'NOTA_DEBITO' && selectedItems.some((item: Record<string, unknown>) =>
        (item.product_type === 'MANUFACTURABLE' && item.requires_advanced_manufacturing) ||
        (item.product_type === 'MANUFACTURABLE' && !item.has_bom)
    );

    const totalNet = selectedItems.reduce((acc, item: any) => acc + (Number(item.quantity) * Number(item.unit_price)), 0)
    const totalTax = selectedItems.reduce((acc, item: any) => acc + (Number(item.quantity) * Number(item.tax_amount)), 0)
    const total = totalNet + totalTax

    const isExempt = originalInvoice?.dte_type === 'FACTURA_EXENTA' || originalInvoice?.dte_type === 'BOLETA_EXENTA'


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
                document_date: dateString || '',
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
            setPaymentData((p: Record<string, unknown>) => ({ ...p, amount: invRes.data.total })) // Correct logic will happen when items are selected

        } catch (error: unknown) {
            console.error("Error initializing note wizard:", error)
            toast.error("Error al cargar datos de la factura original.")
            onOpenChange(false)
        } finally {
            setInitializing(false)
        }
    }

    // Sync date when server date arrives
    useEffect(() => {
        if (dateString && !registrationData.document_date) {
            setRegistrationData((prev: Record<string, unknown>) => ({ ...prev, document_date: dateString }))
        }
    }, [dateString])

    // Update payment amount when totals change
    useEffect(() => {
        setPaymentData((prev: Record<string, unknown>) => ({ ...prev, amount: total }))
    }, [total])


    const handleNext = async () => {
        // Validations per step
        if (step === 1) {
            if (selectedItems.length === 0) {
                toast.error("Seleccione al menos un ítem.")
                return
            }
            if (hasManufacturing) {
                setStep(5) // Step 5: Manufacturing
            } else if (requiresLogistics) {
                setStep(2)
            } else {
                setStep(3)
            }
        }
        else if (step === 5) {
            // ... (mfg items check)
            const pendingItems = selectedItems.filter((line: Record<string, unknown>) =>
                (line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing && !line.manufacturing_data) ||
                (line.product_type === 'MANUFACTURABLE' && !line.has_bom && !line.manufacturing_data)
            )
            if (pendingItems.length > 0) {
                toast.error(`Tiene ${pendingItems.length} productos sin configurar detalles de fabricación.`)
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
            if (!registrationData.is_pending && !registrationData.attachment) {
                toast.error("El archivo adjunto es obligatorio para registrar el documento.")
                return
            }
            if (!registrationData.document_number && !registrationData.is_pending) {
                toast.error("Ingrese el número de folio.")
                return
            }

            // TAX PERIOD VALIDATION (Handled visually in live, but enforced here)
            if (!registrationData.is_pending && !isPeriodValid) {
                toast.error(
                    `No se puede registrar. El periodo está cerrado.`,
                    { duration: 5000, icon: <ShieldAlert className="h-5 w-5 text-destructive" /> }
                )
                return
            }

            setStep(4)
        }
    }

    const handleBack = () => {
        if (step === 5) {
            setStep(1)
        } else if (step === 2) {
            if (hasManufacturing) {
                setStep(5)
            } else {
                setStep(1)
            }
        } else if (step === 3) {
            if (requiresLogistics) {
                setStep(2)
            } else if (hasManufacturing) {
                setStep(5)
            } else {
                setStep(1)
            }
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
            formData.append('selected_items', JSON.stringify(selectedItems.map(i => {
                // Clean up manufacturing_data for JSON (File objects can't be stringified)
                let cleanMfgData = null
                if (i.manufacturing_data) {
                    const mfgData = i.manufacturing_data as any
                    const { design_files, approval_file, ...rest } = mfgData
                    cleanMfgData = {
                        ...rest,
                        design_filenames: (design_files || []).map((f: File) => f.name),
                        approval_filename: approval_file ? approval_file.name : null
                    }
                }

                return {
                    line_id: i.line_id,
                    product_id: i.product_id,
                    quantity: i.quantity,
                    unit_price: i.unit_price,
                    tax_amount: i.tax_amount,
                    reason: i.reason,
                    manufacturing_data: cleanMfgData
                }
            })))

            // Append manufacturing files per item
            selectedItems.forEach((item: any, itemIdx: number) => {
                if (item.manufacturing_data) {
                    const mfgData = item.manufacturing_data as any
                    if (mfgData.design_files) {
                        mfgData.design_files.forEach((file: File, fileIdx: number) => {
                            formData.append(`line_${itemIdx}_design_${fileIdx}`, file)
                        })
                    }
                    if (mfgData.approval_file) {
                        formData.append(`line_${itemIdx}_approval`, mfgData.approval_file)
                    }
                }
            })

            // Logistics
            if (requiresLogistics && logisticsData) {
                formData.append('logistics_data', JSON.stringify(logisticsData))
            }

            // Registration
            const regData = registrationData as any
            const { attachment, ...regRest } = regData
            formData.append('registration_data', JSON.stringify(regRest))
            if (attachment) {
                formData.append('document_attachment', attachment as Blob)
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

        } catch (error: unknown) {
            console.error("Checkout error:", error)
            showApiError(error, "Error al finalizar el proceso.")
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
                        originalInvoice={originalInvoice || {}}
                        selectedItems={selectedItems}
                        setSelectedItems={setSelectedItems}
                        isCreditNote={initialType === 'NOTA_CREDITO'}
                    />
                )
            case 5:
                return (
                    <Step2_ManufacturingDetails
                        orderLines={selectedItems as any}
                        setOrderLines={setSelectedItems as any}
                    />
                )
            case 2:
                // We need to confirm props for Step2
                return (
                    <Step2_Logistics
                        isCreditNote={initialType === 'NOTA_CREDITO'}
                        data={logisticsData}
                        setData={setLogisticsData}
                        selectedItems={selectedItems}
                    />
                )
            case 3:
                return (
                    <Step3_Registration
                        isCreditNote={initialType === 'NOTA_CREDITO'}
                        data={registrationData}
                        setData={setRegistrationData}
                        onPeriodValidityChange={(isValid) => setIsPeriodValid(isValid)}
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

    // Dynamic Step Sequence
    const stepsSequence = ['items']
    if (hasManufacturing) stepsSequence.push('manufacturing')
    if (requiresLogistics) stepsSequence.push('logistics')
    stepsSequence.push('dte', 'payment')

    const stepToId: Record<number, string> = {
        1: 'items',
        5: 'manufacturing',
        2: 'logistics',
        3: 'dte',
        4: 'payment'
    }

    const currentStepId = stepToId[step]
    const currentStepIndex = stepsSequence.indexOf(currentStepId) + 1
    const totalStepsCount = stepsSequence.length

    const isLastStep = currentStepId === 'payment'
    const isStepLoading = loading || initializing

    const getNextButtonLabel = () => {
        if (isStepLoading) return "Procesando..."
        if (isLastStep) return "Finalizar Proceso"
        return "Siguiente"
    }

    return (
        <BaseModal
            open={open}
            onOpenChange={(val) => !isStepLoading && onOpenChange(val)}
            size="full"
            className="h-[90vh]"
            contentClassName="p-0"
            title={
                <div className="flex items-center gap-4">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                        <div className="flex items-center gap-2">
                            <span className="font-black tracking-tighter uppercase block text-lg">
                                {title}
                            </span>
                            {isExempt && (
                                <span className="px-1.5 py-0.5 bg-success/10 text-success text-[10px] font-black uppercase rounded shadow-sm border border-success/20">
                                    Documento Exento
                                </span>
                            )}
                        </div>
                        {originalInvoice && (
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-0.5">
                                corrigiendo {originalInvoice.dte_type_display} {originalInvoice.number}
                            </p>
                        )}

                </div>
            }
            footer={
                <div className="w-full flex justify-between items-center">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={step === 1 || isStepLoading}
                        className="h-12 px-6 font-bold"
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Atrás
                    </Button>

                    {!isLastStep ? (
                        <Button
                            onClick={handleNext}
                            className="w-40 h-12 font-bold shadow-md transition-all"
                            disabled={isStepLoading || (currentStepId === 'dte' && !isPeriodValid)}
                        >
                            Siguiente
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleFinish}
                            className="w-48 h-12 bg-success hover:bg-success font-bold shadow-md transition-all"
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
            }
        >
            <div className="flex flex-1 overflow-hidden relative h-full">
                {/* Left Sidebar */}
                {!initializing && (
                    <NoteProcessSidebar
                        currentStep={currentStepIndex}
                        totalSteps={totalStepsCount}
                        noteType={initialType}
                        requiresLogistics={requiresLogistics}
                        hasManufacturing={hasManufacturing}
                        itemsCount={selectedItems.length}
                        dteNumber={registrationData.document_number}
                        paymentData={paymentData}
                    />
                )}

                {/* Center Content */}
                <div className="flex-1 flex flex-col min-w-0 h-full relative border-r">
                    <div className="flex-1 p-10 overflow-y-auto bg-background custom-scrollbar">
                        <div className="max-w-4xl mx-auto">
                            {renderStep()}
                        </div>
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
                            isExempt={isExempt}
                        />
                    </div>
                )}
            </div>
        </BaseModal>
    )
}

