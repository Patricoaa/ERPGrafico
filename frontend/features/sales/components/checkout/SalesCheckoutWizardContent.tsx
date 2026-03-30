"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { PricingUtils } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Step1_DTE } from "./Step1_DTE"
import { Step2_Payment } from "./Step2_Payment"
import { useTreasuryAccounts } from "@/hooks/useTreasuryAccounts"
import { useAllowedPaymentMethods } from "@/hooks/useAllowedPaymentMethods"
import { Step3_Delivery } from "./Step3_Delivery"
import { Step2_ManufacturingDetails } from "./Step2_ManufacturingDetails"
import { OrderSummaryCard } from "./OrderSummaryCard"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { ProcessSummarySidebar } from "./ProcessSummarySidebar"
import { toast } from "sonner"
import api from "@/lib/api"
import { Step0_Customer } from "./Step0_Customer"
import { Check, ChevronRight, ChevronLeft, Loader2, ShoppingCart, AlertCircle, AlertTriangle, ShieldAlert } from "lucide-react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useAuth } from "@/contexts/AuthContext"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useServerDate } from "@/hooks/useServerDate"

export interface SalesCheckoutWizardContentProps {
    order: any | null
    orderLines: any[]
    total: number
    totalDiscountAmount?: number
    onComplete: () => void
    onCancel?: () => void
    customerName?: string
    initialCustomerName?: string
    initialCustomerId?: string
    channel?: string
    posSessionId?: number | null
    terminalId?: number
    quickSale?: boolean
    initialStep?: number
    initialDteData?: any
    initialPaymentData?: any
    initialDeliveryData?: any
    initialApprovalTaskId?: number | null
    initialIsWaitingApproval?: boolean
    initialIsApproved?: boolean
    initialDraftId?: number | null
    onStateChange?: (state: any) => void
    isInline?: boolean // Flag to adjust UI for inline use
}

export function SalesCheckoutWizardContent({
    order,
    orderLines: initialOrderLines,
    total: initialTotal,
    totalDiscountAmount = 0,
    onComplete,
    onCancel,
    initialCustomerName = "",
    initialCustomerId = "",
    channel = "POS",
    posSessionId = null,
    terminalId,
    quickSale = false,
    initialStep,
    initialDteData,
    initialPaymentData,
    initialDeliveryData,
    initialApprovalTaskId,
    initialIsWaitingApproval,
    initialIsApproved,
    initialDraftId,
    onStateChange,
    isInline = false
}: SalesCheckoutWizardContentProps) {
    const [step, setStep] = useState(initialStep || 1)
    const [loading, setLoading] = useState(false)
    const [currentOrderLines, setCurrentOrderLines] = useState(initialOrderLines)
    const { dateString, serverDate } = useServerDate()
    const { openHub } = useHubPanel()
    const { hasPermission } = useAuth()
    const canDirectApprove = hasPermission('sales.approve_credit')

    // Use a ref to track whether we've already hydrated
    const didHydrateRef = useRef(false)

    // Sync order lines and hydrate step data
    useEffect(() => {
        if (!didHydrateRef.current) {
            didHydrateRef.current = true
            setCurrentOrderLines(initialOrderLines)
            
            if (quickSale) {
                const currentIsOnlyService = initialOrderLines.every((line: any) => line.product_type === 'SERVICE');
                const currentHasManufacturing = initialOrderLines.some((line: any) =>
                    line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing
                );
                const lastStep = (currentIsOnlyService ? 3 : 4) + (currentHasManufacturing ? 1 : 0);
                
                const jumpStep = (initialStep && initialStep > 1) ? initialStep : lastStep
                setStep(jumpStep)

                setDteData(initialDteData ?? {
                    type: 'BOLETA',
                    number: '',
                    date: dateString || '',
                    attachment: null,
                    isPending: false
                })
                setDeliveryData(initialDeliveryData ?? {
                    type: 'IMMEDIATE',
                    date: null,
                    notes: ''
                })

                if (initialCustomerId) {
                    setSelectedCustomerId(initialCustomerId)
                }
            } else {
                setStep(initialStep ?? 1)
                setDteData(initialDteData ?? {
                    type: 'BOLETA',
                    number: '',
                    date: dateString || '',
                    attachment: null,
                    isPending: false
                })
                setDeliveryData(initialDeliveryData ?? {
                    type: 'IMMEDIATE',
                    date: null,
                    notes: ''
                })
            }
            
            setPaymentData(initialPaymentData ?? {
                method: 'CASH',
                amount: 0,
                transactionNumber: '',
                treasuryAccountId: null,
                isPending: false
            })

            setSelectedCustomerId(initialCustomerId ?? null)
            setSelectedCustomerName(initialCustomerName ?? null)
            setSelectedCustomer(null)
        }
    }, [initialStep, quickSale]) 

    const [dteData, setDteData] = useState(initialDteData || {
        type: 'BOLETA',
        number: '',
        date: '',
        attachment: null,
        isPending: false
    })

    useEffect(() => {
        if (dateString && !initialDteData) {
            setDteData((prev: any) => ({ ...prev, date: dateString }))
        }
    }, [dateString, initialDteData])

    const currentTotal = useMemo(() => {
        const isExempt = dteData.type === 'FACTURA_EXENTA' || dteData.type === 'BOLETA_EXENTA';
        const linesTotal = currentOrderLines.reduce((acc: number, line: any) => {
            const net = PricingUtils.calculateLineNet(line.qty || line.quantity, line.unit_price_net || line.unit_price);
            if (isExempt) return acc + net;
            if (line.total_gross !== undefined) return acc + line.total_gross;
            return acc + PricingUtils.netToGross(net);
        }, 0);
        return Math.max(0, linesTotal - totalDiscountAmount);
    }, [currentOrderLines, dteData.type, totalDiscountAmount]);

    const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId)
    const [selectedCustomerName, setSelectedCustomerName] = useState(initialCustomerName)
    const [selectedCustomer, setSelectedCustomer] = useState<any>(null)

    const [paymentData, setPaymentData] = useState(initialPaymentData || {
        method: 'CASH',
        amount: 0,
        transactionNumber: '',
        treasuryAccountId: null,
        isPending: false
    })

    // Track previous total to know when it changes
    const prevTotalRef = useRef(currentTotal)

    useEffect(() => {
        const hasTotalChanged = prevTotalRef.current !== currentTotal
        if (hasTotalChanged) {
            // If the payment amount was matching the previous total, update it to the new total
            if (paymentData.amount === prevTotalRef.current || paymentData.amount === 0) {
                setPaymentData((prev: any) => ({ ...prev, amount: currentTotal }))
            }
            prevTotalRef.current = currentTotal
        }
    }, [currentTotal, paymentData.amount])

    const [isWaitingApproval, setIsWaitingApproval] = useState(initialIsWaitingApproval || false)
    const [approvalTaskId, setApprovalTaskId] = useState<number | null>(initialApprovalTaskId || null)
    const [creditApprovalRequired, setCreditApprovalRequired] = useState(!!initialIsWaitingApproval || !!initialIsApproved)
    const [approvedTaskData, setApprovedTaskData] = useState<any | null>(null)
    const [securityErrorMessage, setSecurityErrorMessage] = useState<string | null>(null)
    const [isApproved, setIsApproved] = useState(initialIsApproved || false)
    const [creditApprovalReason, setCreditApprovalReason] = useState<string | null>(null)
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

    const [deliveryData, setDeliveryData] = useState<any>(initialDeliveryData || {
        type: 'IMMEDIATE',
        date: null,
        notes: ''
    })

    const hasManufacturing = currentOrderLines.some((line: any) =>
        line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing
    );

    const [salesSettings, setSalesSettings] = useState<any>(null)
    const [pendingDebts, setPendingDebts] = useState<any[] | null>(null)
    const [loadingDebts, setLoadingDebts] = useState(false)

    useEffect(() => {
        if (selectedCustomer && (Number(selectedCustomer.credit_balance_used || 0) > 0)) {
            setLoadingDebts(true)
            api.get(`/contacts/${selectedCustomer.id}/credit_ledger/`)
                .then(res => {
                    const pending = res.data.filter((d: any) => Number(d.balance) > 0)
                    setPendingDebts(pending)
                })
                .catch(err => console.error("Error fetching credit ledger:", err))
                .finally(() => setLoadingDebts(false))
        } else {
            setPendingDebts(null)
        }
    }, [selectedCustomer])

    useEffect(() => {
            api.get('/accounting/settings/current/')
                .then(res => setSalesSettings(res.data))
                .catch(err => console.error("Error fetching sales settings:", err))
    }, [])

    useEffect(() => {
        if (selectedCustomerId) {
            api.get(`/contacts/${selectedCustomerId}/`)
                .then(res => {
                    setSelectedCustomer(res.data)
                    setSelectedCustomerName(res.data.name)
                })
                .catch(err => console.error("Error fetching full customer details:", err))
        } else {
            setSelectedCustomer(null)
        }
    }, [selectedCustomerId])

    useEffect(() => {
        if (onStateChange) {
            onStateChange({
                step,
                dteData,
                paymentData,
                isApproved,
                isLoading: loading,
                selectedCustomerId,
                selectedCustomerName
            })
        }
    }, [step, dteData, paymentData, deliveryData, approvalTaskId, isWaitingApproval, isApproved, loading, onStateChange, selectedCustomerId, selectedCustomerName])

    const isOnlyService = currentOrderLines.every((line: any) => line.product_type === 'SERVICE');
    const totalSteps = useMemo(() => (isOnlyService ? 3 : 4) + (hasManufacturing ? 1 : 0), [isOnlyService, hasManufacturing]);

    const { accounts } = useTreasuryAccounts({
        context: terminalId ? 'POS' : 'GENERAL',
        terminalId
    })

    const { methods: allowedMethods, loading: loadingMethods } = useAllowedPaymentMethods({
        terminalId,
        operation: 'sales',
        enabled: true
    })

    const renderStep = () => {
        let currentStepNum = 1;
        if (step === currentStepNum) {
            return (
                <Step0_Customer
                    selectedCustomerId={selectedCustomerId}
                    setSelectedCustomerId={(id) => setSelectedCustomerId(id || "")}
                    setSelectedCustomerName={setSelectedCustomerName}
                />
            )
        }
        currentStepNum++;
        if (hasManufacturing) {
            if (step === currentStepNum) {
                return (
                    <Step2_ManufacturingDetails
                        orderLines={currentOrderLines}
                        setOrderLines={setCurrentOrderLines}
                    />
                )
            }
            currentStepNum++;
        }
        if (step === currentStepNum) {
            return (
                <Step1_DTE
                    dteData={dteData}
                    setDteData={setDteData}
                    isDefaultCustomer={!!selectedCustomer?.is_default_customer}
                />
            )
        }
        currentStepNum++;
        if (!isOnlyService && step === currentStepNum) {
            return <Step3_Delivery deliveryData={deliveryData} setDeliveryData={setDeliveryData} orderLines={currentOrderLines} />
        }
        if (!isOnlyService) currentStepNum++;
        if (step === currentStepNum) {
            return <Step2_Payment paymentData={paymentData} setPaymentData={setPaymentData} total={currentTotal} terminalId={terminalId} customerCreditBalance={Number(selectedCustomer?.credit_balance || 0)} />
        }
        return null;
    }

    const validateCurrentStep = async (): Promise<{ isValid: boolean, requireApproval?: boolean }> => {
        try {
            setCreditApprovalRequired(false)
            let currentStepNum = 1;
            if (step === currentStepNum) {
                if (!selectedCustomerId) {
                    toast.error("Debe seleccionar un cliente para continuar.")
                    return { isValid: false }
                }
                if (hasManufacturing && selectedCustomer?.is_default_customer) {
                    toast.error("No se puede utilizar el cliente por defecto para productos con fabricación avanzada.")
                    return { isValid: false }
                }
                return { isValid: true }
            }
            currentStepNum++;
            if (hasManufacturing) {
                if (step === currentStepNum) {
                    const pendingItems = currentOrderLines.filter((line: any) =>
                        line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing && !line.manufacturing_data
                    )
                    if (pendingItems.length > 0) {
                        toast.error(`Tiene ${pendingItems.length} productos sin configurar detalles de fabricación.`)
                        return { isValid: false }
                    }
                    return { isValid: true }
                }
                currentStepNum++;
            }
            if (step === currentStepNum) {
                if (dteData.type !== 'BOLETA' && !dteData.isPending) {
                    if (!dteData.number || !dteData.date || !dteData.attachment) {
                        toast.error("Faltan datos obligatorios del documento DTE.")
                        return { isValid: false }
                    }
                }
                return { isValid: true }
            }
            currentStepNum++;
            if (!isOnlyService && step === currentStepNum) return { isValid: true }
            if (!isOnlyService) currentStepNum++;
            if (step === currentStepNum) {
                if (!paymentData.method) {
                    toast.error("Debe seleccionar un método de pago.")
                    return { isValid: false }
                }
                if (paymentData.method !== 'CREDIT' && paymentData.method !== 'CREDIT_BALANCE' && paymentData.amount > 0) {
                    if (!paymentData.treasuryAccountId) {
                        toast.error("Debe seleccionar una cuenta de destino.")
                        return { isValid: false }
                    }
                }
                if (!approvalTaskId && !isApproved) {
                    const amountPaid = paymentData.amount || 0;
                    if (amountPaid < currentTotal) {
                        const requiredCredit = currentTotal - amountPaid;
                        const creditAvailable = Number(selectedCustomer?.credit_available || 0);
                        if (requiredCredit > creditAvailable) {
                            setCreditApprovalReason(`Crédito insuficiente (Disponible: $${creditAvailable.toLocaleString()}).`);
                            setCreditApprovalRequired(true);
                            return { isValid: false, requireApproval: true };
                        }
                    }
                }
                return { isValid: true }
            }
            return { isValid: true }
        } catch (error) {
            console.error("Error en validación de checkout:", error)
            toast.error("Ocurrió un error inesperado al validar la venta.")
            return { isValid: false }
        }
    }


    const handleNext = async () => {
        const validation = await validateCurrentStep()
        if (!validation.isValid) return
        setStep(prev => prev + 1)
    }

    const handleBack = () => {
        if (step === 1 && onCancel) {
            onCancel()
        } else {
            setStep(prev => Math.max(1, prev - 1))
        }
    }

    // Checkout handlers
    const executeCheckout = async () => {
        setLoading(true)
        try {
            const formData = new FormData()

            const payloadOrder = order ? { id: order.id } : {
                customer: selectedCustomerId ? parseInt(selectedCustomerId) : null,
                payment_method: paymentData.method,
                channel: channel,
                total_discount_amount: totalDiscountAmount,
                lines: currentOrderLines.map((l: any) => {
                    let cleanMfgData = null
                    if (l.manufacturing_data) {
                        const { design_files, approval_file, ...rest } = l.manufacturing_data
                        cleanMfgData = {
                            ...rest,
                            design_filenames: (design_files || []).map((f: any) => f.name),
                            approval_filename: approval_file ? approval_file.name : null
                        }
                    }
                    return {
                        product: l.product || l.id || null,
                        description: l.name || l.product_name || l.description,
                        quantity: l.qty || l.quantity,
                        unit_price: l.unit_price_net || l.unit_price,
                        unit_price_gross: l.unit_price_gross,
                        uom: l.uom || null,
                        tax_rate: (dteData.type === 'FACTURA_EXENTA' || dteData.type === 'BOLETA_EXENTA') ? 0 : 19,
                        discount_amount: l.discount_amount || 0,
                        discount_percentage: parseFloat(((l.discount_percentage || 0)).toFixed(2)),
                        manufacturing_data: cleanMfgData
                    }
                })
            }
            formData.append('order_data', JSON.stringify(payloadOrder))

            currentOrderLines.forEach((l: any, lineIdx: number) => {
                if (l.manufacturing_data) {
                    if (l.manufacturing_data.design_files) {
                        l.manufacturing_data.design_files.forEach((file: File, fileIdx: number) => {
                            formData.append(`line_${lineIdx}_design_${fileIdx}`, file)
                        })
                    }
                    if (l.manufacturing_data.approval_file) {
                        formData.append(`line_${lineIdx}_approval`, l.manufacturing_data.approval_file)
                    }
                }
            })

            formData.append('dte_type', dteData.type)
            formData.append('is_pending_registration', dteData.isPending.toString())
            if (dteData.number) formData.append('document_number', dteData.number)
            if (dteData.date) formData.append('document_date', dteData.date)
            if (dteData.attachment) formData.append('document_attachment', dteData.attachment)

            const finalPaymentMethod = paymentData.amount === 0 ? 'CREDIT' : paymentData.method
            formData.append('payment_method', finalPaymentMethod)
            if (paymentData.paymentMethodId && paymentData.amount > 0) {
                formData.append('payment_method_id', paymentData.paymentMethodId.toString())
            }
            formData.append('amount', paymentData.amount.toString())
            formData.append('payment_is_pending', paymentData.isPending.toString())
            if (paymentData.transactionNumber && paymentData.amount > 0) formData.append('transaction_number', paymentData.transactionNumber)
            if (paymentData.treasuryAccountId && paymentData.amount > 0) formData.append('treasury_account_id', paymentData.treasuryAccountId)
            formData.append('payment_type', 'INBOUND')

            formData.append('delivery_type', deliveryData.type)
            if (deliveryData.date) formData.append('delivery_date', deliveryData.date)
            if (deliveryData.notes) formData.append('delivery_notes', deliveryData.notes)

            if (deliveryData.type === 'PARTIAL' && deliveryData.partialQuantities) {
                formData.append('immediate_lines', JSON.stringify(deliveryData.partialQuantities.map((pq: any) => ({
                    line_id: pq.lineId,
                    product_id: pq.productId,
                    quantity: pq.dispatchedQty,
                    uom: pq.uom
                }))))
            }

            if (posSessionId) {
                formData.append('pos_session_id', posSessionId.toString())
            }

            if (approvalTaskId) {
                formData.append('credit_approval_task_id', approvalTaskId.toString())
            }

            if (isApproved && !approvalTaskId) {
                formData.append('direct_credit_approval', 'true')
            }

            if (initialDraftId) {
                formData.append('draft_id', initialDraftId.toString())
            }

            await api.post('/billing/invoices/pos_checkout/', formData)
            toast.success("Venta procesada correctamente")
            onComplete()
        } catch (error: any) {
            console.error("Checkout error:", error)
            const rawError = error.response?.data?.error || "Error al procesar la venta"
            const errorMessage = Array.isArray(rawError) ? rawError[0] : String(rawError)
            
            if (errorMessage.includes("Intento de aumento de crédito") || 
                errorMessage.includes("Aprobación de crédito fue emitida para otro cliente") ||
                errorMessage.includes("Seguridad:")) {
                setSecurityErrorMessage(errorMessage)
            } else {
                toast.error(errorMessage)
            }

            setLoading(false)

            if (approvalTaskId && !errorMessage.includes("Intento de aumento") && !errorMessage.includes("Seguridad:")) {
                setApprovalTaskId(null)
                setIsWaitingApproval(false)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleFinish = async () => {
        const validation = await validateCurrentStep()
        if (validation.requireApproval) return
        if (!validation.isValid) return
        executeCheckout()
    }

    const handleRequestApproval = async () => {
        setIsWaitingApproval(true)
        try {
            // Re-using logic to build formData
            // This would normally be abstracted into a helper
            const payloadOrder = order ? { id: order.id } : {
                customer: selectedCustomerId ? parseInt(selectedCustomerId) : null,
                payment_method: paymentData.method,
                channel: channel,
                total_discount_amount: totalDiscountAmount,
                lines: currentOrderLines.map((l: any) => ({
                    product: l.product || l.id || null,
                    description: l.name || l.product_name || l.description,
                    quantity: l.qty || l.quantity,
                    unit_price: l.unit_price_net || l.unit_price,
                    unit_price_gross: l.unit_price_gross,
                    uom: l.uom || null,
                    tax_rate: (dteData.type === 'FACTURA_EXENTA' || dteData.type === 'BOLETA_EXENTA') ? 0 : 19,
                    discount_amount: l.discount_amount || 0,
                    discount_percentage: parseFloat(((l.discount_percentage || 0)).toFixed(2))
                }))
            }
            const formData = new FormData()
            formData.append('order_data', JSON.stringify(payloadOrder))
            formData.append('dte_type', dteData.type)
            formData.append('payment_method', paymentData.method)
            formData.append('amount', paymentData.amount.toString())
            if (posSessionId) formData.append('pos_session_id', posSessionId.toString())
            if (initialDraftId) formData.append('draft_id', initialDraftId.toString())

            const response = await api.post('/billing/invoices/request_credit/', formData)
            const taskId = response.data.task_id
            setApprovalTaskId(taskId)
            pollApprovalStatus(taskId)
        } catch (error: any) {
            console.error("Error requesting approval:", error)
            toast.error(error.response?.data?.error || "Error al solicitar aprobación")
            setIsWaitingApproval(false)
        }
    }

    const pollApprovalStatus = (taskId: number) => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)

        pollingIntervalRef.current = setInterval(async () => {
            try {
                const response = await api.get(`/workflow/tasks/${taskId}/`)
                const task = response.data

                if (task.status === 'COMPLETED') {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
                    toast.success("¡Crédito aprobado!")
                    setApprovedTaskData(task.data)
                    setIsWaitingApproval(false)
                    setIsApproved(true)
                } else if (task.status === 'REJECTED' || task.status === 'CANCELLED') {
                    if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
                    toast.error("La solicitud de crédito fue rechazada.")
                    setIsWaitingApproval(false)
                    setApprovalTaskId(null)
                }
            } catch (error) {
                console.error("Error polling task:", error)
            }
        }, 3000)
    }

    const cancelApprovalRequest = () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        setIsWaitingApproval(false)
        setApprovalTaskId(null)
        setCreditApprovalRequired(false)
    }

    const handleDirectApproval = () => {
        setIsApproved(true)
        setCreditApprovalRequired(false)
        setCreditApprovalReason(null)
        toast.success("Venta aprobada directamente")
    }

    useEffect(() => {
        return () => { if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current) }
    }, [])

    return (
        <div className={`flex h-full min-h-0 ${isInline ? 'flex-col' : ''}`}>
            {!isInline && (
                <ProcessSummarySidebar
                    currentStep={step}
                    totalSteps={totalSteps}
                    customerName={selectedCustomerName}
                    hasManufacturing={hasManufacturing}
                    dteType={step > (hasManufacturing ? 2 : 1) ? dteData.type : undefined}
                    paymentData={step > (hasManufacturing ? 4 : 3) ? {
                        method: paymentData.method,
                        amount: paymentData.amount,
                        creditAssigned: paymentData.amount < currentTotal ? currentTotal - paymentData.amount : 0
                    } : undefined}
                    deliveryData={step > (hasManufacturing ? 3 : 2) ? deliveryData : undefined}
                />
            )}

            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 p-6 overflow-y-auto">
                    {/* Alerts and Step Rendering */}
                    {creditApprovalRequired && !isApproved && (
                         <Alert className="mb-4 border-amber-500/50 bg-amber-500/5">
                            {isWaitingApproval ? (
                                <Loader2 className="h-4 w-4 text-amber-500 animate-spin" />
                            ) : (
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                            )}
                            <AlertTitle className="text-amber-700 font-bold">
                                {isWaitingApproval ? "Esperando Autorización..." : "Autorización Requerida"}
                            </AlertTitle>
                            <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                                <span className="text-amber-700/80 text-sm">
                                    {isWaitingApproval 
                                        ? "La solicitud ha sido enviada. Consumiendo en tiempo real el estado de la verificación..." 
                                        : creditApprovalReason}
                                </span>
                                <div className="flex gap-2">
                                    {isWaitingApproval ? null : (
                                        <>
                                            <Button size="sm" variant="outline" onClick={cancelApprovalRequest} className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10">
                                                Ajustar
                                            </Button>
                                            {canDirectApprove && (
                                                <Button size="sm" variant="secondary" onClick={handleDirectApproval} className="bg-amber-500 hover:bg-amber-600 text-white border-none shadow-sm">
                                                    Aprobar
                                                </Button>
                                            )}
                                            <Button size="sm" onClick={handleRequestApproval} className="bg-primary hover:bg-primary/90 text-white shadow-sm">
                                                Solicitar
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </AlertDescription>
                         </Alert>
                    )}
                    
                    <div className={(creditApprovalRequired || isWaitingApproval) && !isApproved ? "opacity-30 pointer-events-none" : ""}>
                        {renderStep()}
                    </div>
                </div>

                {isInline && (
                    <div className="p-6 border-t bg-background/50 flex justify-between items-center">
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={handleBack} disabled={loading} className="font-bold">
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Atrás
                            </Button>
                            <Button variant="ghost" onClick={onCancel} disabled={loading} className="text-muted-foreground hover:text-primary transition-colors h-10 px-4">
                                <ShoppingCart className="mr-2 h-4 w-4" />
                                Volver al Carrito
                            </Button>
                        </div>
                        <div className="flex gap-4">
                            {step < totalSteps ? (
                                <Button onClick={handleNext} className="w-40 font-bold">
                                    Siguiente
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button onClick={handleFinish} disabled={loading || isWaitingApproval} className="w-48 bg-success font-bold">
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                    Finalizar Venta
                                </Button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {!isInline && (
                <div className="w-80 border-l hidden lg:block overflow-y-auto">
                    <OrderSummaryCard
                        orderLines={currentOrderLines}
                        total={currentTotal}
                        totalDiscountAmount={totalDiscountAmount}
                        dteType={dteData.type}
                        customer={selectedCustomer}
                    />
                </div>
            )}
        </div>
    )
}
