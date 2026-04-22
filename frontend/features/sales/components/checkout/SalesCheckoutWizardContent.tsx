"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { PricingUtils } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Step1_CustomerDTE } from "./Step1_CustomerDTE"
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

import { Check, ChevronRight, ChevronLeft, Loader2, ShoppingCart, AlertCircle, AlertTriangle, ShieldAlert, CheckCircle2, FileWarning, Printer } from "lucide-react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
import { useAuth } from "@/contexts/AuthContext"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useServerDate } from "@/hooks/useServerDate"
import { BaseModal } from "@/components/shared/BaseModal"
import { PINPadModal } from "@/features/pos/components/PINPadModal"
import { SaleOrder, SaleOrderLine, CheckoutDTEData, CheckoutPaymentData, CheckoutDeliveryData, PendingDebt, AccountingSettings, CheckoutResponse, CreditApprovalTask } from "../../types"
import { Contact } from "@/features/contacts/types"
import { ManualTerminalNotice, ManualTerminalReason } from "@/features/treasury"

export interface CheckoutWizardState {
    step: number
    dteData: CheckoutDTEData
    paymentData: CheckoutPaymentData
    deliveryData: CheckoutDeliveryData
    isApproved: boolean
    isLoading: boolean
    selectedCustomerId: string | null
    selectedCustomerName: string
    isQuickSale: boolean
    isWaitingPayment: boolean
}

export interface SalesCheckoutWizardContentProps {
    order: SaleOrder | null
    orderLines: SaleOrderLine[]
    total: number
    totalDiscountAmount?: number
    onComplete: (data?: CheckoutResponse) => void
    onCancel?: () => void
    onSuspend?: (finalState: CheckoutWizardState) => void
    customerName?: string
    initialCustomerName?: string
    initialCustomerId?: string
    channel?: string
    posSessionId?: number | null
    terminalId?: number
    terminalDeviceId?: number | null
    quickSale?: boolean
    initialStep?: number
    initialDteData?: CheckoutDTEData
    initialPaymentData?: CheckoutPaymentData
    initialDeliveryData?: CheckoutDeliveryData
    initialApprovalTaskId?: number | null
    initialIsWaitingApproval?: boolean
    initialIsApproved?: boolean
    initialDraftId?: number | null
    onStateChange?: (state: CheckoutWizardState) => void
    isInline?: boolean
    isSessionHost?: boolean
}

export function SalesCheckoutWizardContent({
    order,
    orderLines: initialOrderLines,
    total: initialTotal,
    totalDiscountAmount = 0,
    onComplete,
    onCancel,
    onSuspend,
    initialCustomerName = "",
    initialCustomerId = "",
    channel = "POS",
    posSessionId = null,
    terminalId,
    terminalDeviceId = null,
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
    isInline = false,
    isSessionHost = false
}: SalesCheckoutWizardContentProps) {
    const { dateString, serverDate } = useServerDate()
    const { openHub, isHubOpen } = useHubPanel()
    const { hasPermission } = useAuth()
    
    const [currentOrderLines, setCurrentOrderLines] = useState<SaleOrderLine[]>(initialOrderLines)
    const [step, setStep] = useState(initialStep || 1)
    const [loading, setLoading] = useState(false)

    const hasManufacturing = useMemo(() => initialOrderLines.some((line: SaleOrderLine) =>
        line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing
    ), [initialOrderLines]);

    const isOnlyService = currentOrderLines.every((line: SaleOrderLine) => line.product_type === 'SERVICE');

    const steps = useMemo(() => {
        const s: { id: string; label: string }[] = [
            { id: 'customer_dte', label: 'Cliente & Doc' },
        ]
        if (hasManufacturing) {
            s.push({ id: 'manufacturing', label: 'Fabricación' })
        }
        if (!isOnlyService) {
            s.push({ id: 'delivery', label: 'Entrega' })
        }
        s.push({ id: 'payment', label: 'Pago' })
        return s
    }, [hasManufacturing, isOnlyService])

    const totalSteps = steps.length;


    const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId)
    const [selectedCustomerName, setSelectedCustomerName] = useState(initialCustomerName)
    const [selectedCustomer, setSelectedCustomer] = useState<Contact | null>(null)
    const [dteData, setDteData] = useState<CheckoutDTEData>(initialDteData || {
        type: 'BOLETA',
        number: '',
        date: dateString || '',
        attachment: null,
        isPending: false
    })
    const [paymentData, setPaymentData] = useState<CheckoutPaymentData>(initialPaymentData || {
        method: 'CASH',
        amount: 0,
        transactionNumber: '',
        treasuryAccountId: null,
        isPending: false
    })
    const [deliveryData, setDeliveryData] = useState<CheckoutDeliveryData>(initialDeliveryData || {
        type: 'IMMEDIATE',
        date: null,
        notes: ''
    })
    const [isFolioValid, setIsFolioValid] = useState(true)

    const [pinModalOpen, setPinModalOpen] = useState(false)

    const [isPeriodValid, setIsPeriodValid] = useState(true)

    const canDirectApprove = hasPermission('sales.approve_credit')
    const didHydrateRef = useRef(false)

    // Sync order lines and hydrate step data
    useEffect(() => {
        if (!didHydrateRef.current) {
            didHydrateRef.current = true
            setCurrentOrderLines(initialOrderLines)
            
            if (quickSale && currentOrderLines.length > 0) {
                if (initialCustomerId) setSelectedCustomerId(initialCustomerId)
                setStep(totalSteps)
            } else if (initialStep && initialStep > 1 && !quickSale) {
                setStep(initialStep)
            } else {
                setStep(initialStep ?? 1)
            }
        }
    }, [initialStep, quickSale, totalSteps, currentOrderLines.length]) 

    useEffect(() => {
        if (dateString && !initialDteData) {
            setDteData((prev: CheckoutDTEData) => ({ ...prev, date: dateString }))
        }
    }, [dateString, initialDteData])

    const currentTotal = useMemo(() => {
        const isExempt = dteData.type === 'FACTURA_EXENTA' || dteData.type === 'BOLETA_EXENTA';
        const linesTotal = currentOrderLines.reduce((acc: number, line: SaleOrderLine) => {
            const net = PricingUtils.calculateLineNet(line.qty || line.quantity, line.unit_price_net || line.unit_price);
            if (isExempt) return acc + net;
            if (line.total_gross !== undefined) return acc + line.total_gross;
            return acc + PricingUtils.netToGross(net);
        }, 0);
        return Math.max(0, linesTotal - totalDiscountAmount);
    }, [currentOrderLines, dteData.type, totalDiscountAmount]);

    const prevTotalRef = useRef(currentTotal)

    useEffect(() => {
        const hasTotalChanged = prevTotalRef.current !== currentTotal
        if (hasTotalChanged) {
            if (paymentData.amount === prevTotalRef.current || paymentData.amount === 0) {
                setPaymentData((prev: CheckoutPaymentData) => ({ ...prev, amount: currentTotal }))
            }
            prevTotalRef.current = currentTotal
        }
    }, [currentTotal, paymentData.amount])

    const [isWaitingApproval, setIsWaitingApproval] = useState(initialIsWaitingApproval || false)
    const [approvalTaskId, setApprovalTaskId] = useState<number | null>(initialApprovalTaskId || null)
    const [creditApprovalRequired, setCreditApprovalRequired] = useState(!!initialIsWaitingApproval || !!initialIsApproved)
    const [approvedTaskData, setApprovedTaskData] = useState<CreditApprovalTask | null>(null)
    const [securityErrorMessage, setSecurityErrorMessage] = useState<string | null>(null)
    const [isApproved, setIsApproved] = useState(initialIsApproved || false)
    const [creditApprovalReason, setCreditApprovalReason] = useState<string | null>(null)
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

    const [salesSettings, setSalesSettings] = useState<AccountingSettings | null>(null)
    const [pendingDebts, setPendingDebts] = useState<PendingDebt[] | null>(null)
    const [loadingDebts, setLoadingDebts] = useState(false)
    const [manualTerminalReason, setManualTerminalReason] = useState<ManualTerminalReason | null>(null)
    const [manualTerminalFailureReason, setManualTerminalFailureReason] = useState<string | null>(null)
    const [showInvoiceReminder, setShowInvoiceReminder] = useState(false)
    const [checkoutResponse, setCheckoutResponse] = useState<CheckoutResponse | null>(null)


    const refreshDebts = useCallback(() => {
        if (selectedCustomer && (Number(selectedCustomer.credit_balance_used || 0) > 0)) {
            setLoadingDebts(true)
            api.get<PendingDebt[]>(`/contacts/${selectedCustomer.id}/credit_ledger/`)
                .then(res => {
                    const pending = res.data.filter((d: PendingDebt) => Number(d.balance) > 0)
                    setPendingDebts(pending)
                })
                .catch(err => console.error("Error fetching credit ledger:", err))
                .finally(() => setLoadingDebts(false))
        } else {
            setPendingDebts(null)
        }
    }, [selectedCustomer])

    useEffect(() => {
        refreshDebts()
    }, [refreshDebts])

    // Sync debts when Hub closes (after potential payments)
    const prevHubOpenRef = useRef(isHubOpen)
    useEffect(() => {
        if (prevHubOpenRef.current && !isHubOpen) {
            refreshDebts()
        }
        prevHubOpenRef.current = isHubOpen
    }, [isHubOpen, refreshDebts])

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
                deliveryData,
                isApproved,
                isLoading: loading,
                selectedCustomerId,
                selectedCustomerName,
                approvalTaskId,
                isWaitingApproval,
                isQuickSale: quickSale,
                isWaitingPayment: step === totalSteps
            } as any)
        }
    }, [step, dteData, paymentData, deliveryData, approvalTaskId, isWaitingApproval, isApproved, loading, quickSale, onStateChange, selectedCustomerId, selectedCustomerName, totalSteps])

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
        const currentStepDef = steps[step - 1];
        if (!currentStepDef) return null;

        switch (currentStepDef.id) {
            case 'customer_dte':
                return (
                    <Step1_CustomerDTE
                        selectedCustomerId={selectedCustomerId}
                        setSelectedCustomerId={(id) => setSelectedCustomerId(id || "")}
                        setSelectedCustomerName={setSelectedCustomerName}
                        dteData={dteData}
                        setDteData={setDteData}
                        isDefaultCustomer={!!selectedCustomer?.is_default_customer}
                        onValidityChange={(isValid) => setIsFolioValid(isValid)}
                        onPeriodValidityChange={(isValid) => setIsPeriodValid(isValid)}
                        pendingDebts={pendingDebts}
                        onDebtClick={(debt) => openHub({ orderId: debt.id, type: 'sale', onActionSuccess: refreshDebts })}
                    />
                )
            case 'manufacturing':
                return (
                    <Step2_ManufacturingDetails
                        orderLines={currentOrderLines}
                        setOrderLines={setCurrentOrderLines}
                    />
                )
            case 'delivery':
                return <Step3_Delivery deliveryData={deliveryData} setDeliveryData={setDeliveryData} orderLines={currentOrderLines} />
            case 'payment':
                return <Step2_Payment paymentData={paymentData} setPaymentData={setPaymentData} total={currentTotal} terminalId={terminalId} customerCreditBalance={Number((selectedCustomer as any)?.credit_balance || 0)} />
            default:
                return null;
        }
    }

    const validateCurrentStep = async (): Promise<{ isValid: boolean, requireApproval?: boolean }> => {
        try {
            setCreditApprovalRequired(false)
            const currentStepDef = steps[step - 1];
            if (!currentStepDef) return { isValid: false };

            switch (currentStepDef.id) {
                case 'customer_dte':
                    if (!selectedCustomerId) {
                        toast.error("Debe seleccionar un cliente para continuar.")
                        return { isValid: false }
                    }
                    if (hasManufacturing && selectedCustomer?.is_default_customer) {
                        toast.error("No se puede utilizar el cliente por defecto para productos con fabricación avanzada.")
                        return { isValid: false }
                    }
                    if (dteData.type !== 'BOLETA' && !dteData.isPending) {
                        if (!dteData.number || !dteData.date || !dteData.attachment) {
                            toast.error("Faltan datos obligatorios del documento DTE.")
                            return { isValid: false }
                        }
                    }

                    // Tax Period Validation (Handled visually in live, but enforced here)
                    if (!dteData.isPending && dteData.date) {
                        if (!isPeriodValid) {
                            toast.error(`No se puede continuar. El periodo ya se encuentra cerrado.`)
                            return { isValid: false }
                        }
                    }
                    return { isValid: true }
                
                case 'manufacturing':
                    const pendingItems = currentOrderLines.filter((line: SaleOrderLine) =>
                        line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing && !line.manufacturing_data
                    )
                    if (pendingItems.length > 0) {
                        toast.error(`Tiene ${pendingItems.length} productos sin configurar detalles de fabricación.`)
                        return { isValid: false }
                    }
                    return { isValid: true }
                
                case 'delivery':
                    return { isValid: true }
                
                case 'payment':
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
                    
                default:
                    return { isValid: true }
            }
        } catch (error) {
            console.error("Error en validación de checkout:", error)
            toast.error("Ocurrió un error inesperado al validar la venta.")
            return { isValid: false }
        }
    }


    const handleNext = async () => {
        const validation = await validateCurrentStep()
        if (!validation.isValid) return

        const currentStepDef = steps[step - 1];
        if (currentStepDef.id === 'customer_dte' && !isFolioValid && !dteData.isPending) {
            toast.error("El número de folio ya ha sido utilizado. Ingrese uno válido para continuar.")
            return
        }

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
    const executeCheckout = async (pin?: string) => {
        setLoading(true)
        try {
            const formData = new FormData()

            const payloadOrder = order ? { id: order.id } : {
                customer: selectedCustomerId ? parseInt(selectedCustomerId) : null,
                payment_method: paymentData.method,
                payment_method_id: paymentData.paymentMethodId ?? null,
                channel: channel,
                total_discount_amount: totalDiscountAmount,
                lines: currentOrderLines.map((l: SaleOrderLine) => {
                    let cleanMfgData = null
                    if (l.manufacturing_data) {
                        const { design_files, approval_file, ...rest } = l.manufacturing_data as any
                        cleanMfgData = {
                            ...rest,
                            design_filenames: ((design_files as any) || []).map((f: File) => f.name),
                            approval_filename: approval_file ? (approval_file as any).name : null
                        }
                    }
                    return {
                        product: l.product || l.id || null,
                        description: l.product_name || l.description,
                        quantity: l.qty || l.quantity || 0,
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

            currentOrderLines.forEach((l: SaleOrderLine, lineIdx: number) => {
                if (l.manufacturing_data) {
                    if ((l.manufacturing_data as any).design_files) {
                        (l.manufacturing_data as any).design_files.forEach((file: File, fileIdx: number) => {
                            formData.append(`line_${lineIdx}_design_${fileIdx}`, file)
                        })
                    }
                    if ((l.manufacturing_data as any).approval_file) {
                        formData.append(`line_${lineIdx}_approval`, (l.manufacturing_data as any).approval_file)
                    }
                }
            })

            formData.append('dte_type', dteData.type)
            formData.append('is_pending_registration', dteData.isPending.toString())
            if (dteData.number) formData.append('document_number', dteData.number)
            if (dteData.date) formData.append('document_date', dteData.date)
            if (dteData.attachment) formData.append('document_attachment', dteData.attachment)
            const finalPaymentMethod = paymentData.amount === 0 ? 'CREDIT' : (paymentData.method || "NOT_SET")
            formData.append('payment_method', finalPaymentMethod)
            if (paymentData.paymentMethodId && paymentData.amount > 0) {
                formData.append('payment_method_id', paymentData.paymentMethodId.toString())
            }
            formData.append('amount', paymentData.amount.toString())
            formData.append('payment_is_pending', paymentData.isPending.toString())
            if (paymentData.transactionNumber && paymentData.amount > 0) formData.append('transaction_number', paymentData.transactionNumber)
            if (paymentData.treasuryAccountId && paymentData.amount > 0) formData.append('treasury_account_id', paymentData.treasuryAccountId.toString())
            formData.append('payment_type', 'INBOUND')

            formData.append('delivery_type', deliveryData.type)
            if (deliveryData.date) formData.append('delivery_date', deliveryData.date)
            if (deliveryData.notes) formData.append('delivery_notes', deliveryData.notes)

            if (deliveryData.type === 'PARTIAL' && deliveryData.partialQuantities) {
                formData.append('immediate_lines', JSON.stringify(deliveryData.partialQuantities.map(pq => ({
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

            if (pin) {
                formData.append('pos_pin', pin)
            }

            const res = await api.post<CheckoutResponse>('/billing/invoices/pos_checkout/', formData)
            toast.success("Venta procesada correctamente")
            onComplete(res.data)
        } catch (error: unknown) {
            console.error("Checkout error:", error)
            const rawError = getErrorMessage(error) || "Error al procesar la venta"
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

    const isTerminalIntegrationPayment = paymentData.isTerminalIntegration === true

    const handleFinish = async () => {
        const validation = await validateCurrentStep()
        if (validation.requireApproval) return
        if (!validation.isValid) return

        if (isTerminalIntegrationPayment && dteData.type === 'BOLETA') {
            setManualTerminalReason('BOLETA_MANUAL')
            return
        }

        if (isTerminalIntegrationPayment && dteData.type !== 'BOLETA') {
            setManualTerminalReason('FACTURA_CARD')
            return
        }

        if (terminalDeviceId && !isTerminalIntegrationPayment && dteData.type === 'BOLETA') {
            // Boleta + pago no-tarjeta en caja con terminal → confirmar cobro manual
            setManualTerminalReason('BOLETA_MANUAL')
            return
        }

        if (terminalDeviceId && !isTerminalIntegrationPayment && dteData.type !== 'BOLETA' && dteData.isPending) {
            setShowInvoiceReminder(true)
            return
        }

        // Flujo directo: sin terminal o factura sin tarjeta
        if (isSessionHost) {
            setPinModalOpen(true)
        } else {
            executeCheckout()
        }
    }

    const handleManualTerminalConfirm = () => {
        setManualTerminalReason(null)
        setManualTerminalFailureReason(null)
        if (isSessionHost) {
            setPinModalOpen(true)
        } else {
            executeCheckout()
        }
    }

    const handleManualTerminalCancel = () => {
        setManualTerminalReason(null)
        setManualTerminalFailureReason(null)
    }

    const handleSwitchPaymentMethod = () => {
        setManualTerminalReason(null)
        setManualTerminalFailureReason(null)
        setPaymentData((prev: CheckoutPaymentData) => ({
            ...prev,
            method: null,
            paymentMethodId: undefined,
            treasuryAccountId: null,
            isTerminalIntegration: false,
        }))
        setStep(totalSteps)
    }

    const handleRequestApproval = async () => {
        setIsWaitingApproval(true)
        try {
            // Re-using logic to build formData
            // This would normally be abstracted into a helper
            const payloadOrder = order ? { id: order.id } : {
                customer: selectedCustomerId ? parseInt(selectedCustomerId) : null,
                payment_method: paymentData.method,
                payment_method_id: paymentData.paymentMethodId ?? null,
                channel: channel,
                total_discount_amount: totalDiscountAmount,
                lines: currentOrderLines.map((l: SaleOrderLine) => ({
                    product: l.product || l.id || null,
                    description: l.product_name || l.description,
                    quantity: l.qty || l.quantity || 0,
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
            formData.append('payment_method', paymentData.method || "NOT_SET")
            formData.append('amount', paymentData.amount.toString())
            if (posSessionId) formData.append('pos_session_id', posSessionId.toString())
            if (initialDraftId) formData.append('draft_id', initialDraftId.toString())

            const response = await api.post('/billing/invoices/request_credit/', formData)
            const taskId = response.data.task_id
            setApprovalTaskId(taskId)
            pollApprovalStatus(taskId)
        } catch (error: unknown) {
            console.error("Error requesting approval:", error)
            showApiError(error, "Error al solicitar aprobación")
            setIsWaitingApproval(false)
        }
    }

    const checkApprovalStatus = async (taskId: number, silent = false) => {
        try {
            const response = await api.get(`/workflow/tasks/${taskId}/`)
            const task = response.data

            if (task.status === 'COMPLETED') {
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
                if (!silent) toast.success("¡Crédito aprobado!") // only explicitly toast if manual check
                setApprovedTaskData(task.data)
                setIsWaitingApproval(false)
                setIsApproved(true)
                return 'COMPLETED'
            } else if (task.status === 'REJECTED' || task.status === 'CANCELLED') {
                if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
                toast.error("La solicitud de crédito fue rechazada.")
                setIsWaitingApproval(false)
                setApprovalTaskId(null)
                return 'REJECTED'
            } else {
                if (!silent) toast.info("Aún está pendiente de autorización...")
                return 'PENDING'
            }
        } catch (error) {
            console.error("Error checking task:", error)
            if (!silent) toast.error("Error al consultar la tarea.")
            return 'ERROR'
        }
    }

    const pollApprovalStatus = (taskId: number) => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)

        // Run immediately first
        checkApprovalStatus(taskId, true)

        pollingIntervalRef.current = setInterval(() => {
            checkApprovalStatus(taskId, true)
        }, 5000)
    }

    // Auto-resume polling if loaded from draft in waiting state
    useEffect(() => {
        if (isWaitingApproval && approvalTaskId && !pollingIntervalRef.current) {
            pollApprovalStatus(approvalTaskId)
        }
    }, [isWaitingApproval, approvalTaskId])

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
                    dteType={step > 1 ? dteData.type : undefined}
                    paymentData={step === totalSteps ? {
                        method: (paymentData.method || "NOT_SET") as string,
                        amount: paymentData.amount,
                        creditAssigned: paymentData.amount < currentTotal ? currentTotal - paymentData.amount : 0
                    } : undefined}
                    deliveryData={steps.findIndex(s => s.id === 'delivery') !== -1 && step > (steps.findIndex(s => s.id === 'delivery') + 1) ? {
                        ...deliveryData,
                        date: deliveryData.date || undefined
                    } : undefined}
                />
            )}

            <div className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 p-6 overflow-y-auto">
                    <>
                        {/* Pending Debts Banner - Removed from here, moved to Step1_CustomerDTE */}


                        {/* Credit Approval Alert */}
                        {creditApprovalRequired && (
                            <Alert className={`mb-4 border ${isApproved ? 'border-success/50 bg-success/5' : 'border-warning/50 bg-warning/5'}`}>
                                {isWaitingApproval ? (
                                    <Loader2 className="h-4 w-4 text-warning animate-spin" />
                                ) : isApproved ? (
                                    <CheckCircle2 className="h-4 w-4 text-success" />
                                ) : (
                                    <AlertCircle className="h-4 w-4 text-warning" />
                                )}
                                <AlertTitle className={`font-bold ${isApproved ? 'text-success-foreground' : 'text-warning-foreground'}`}>
                                    {isWaitingApproval ? "Esperando Autorización..." : isApproved ? "Crédito Aprobado" : "Autorización Requerida"}
                                </AlertTitle>
                                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                                    <span className={`text-sm ${isApproved ? 'text-success-foreground/80' : 'text-warning-foreground/80'}`}>
                                        {isWaitingApproval 
                                            ? "La solicitud ha sido enviada. Consumiendo en tiempo real el estado de la verificación..." 
                                            : isApproved 
                                                ? "El supervisor ha verificado y autorizado la línea de crédito. Puede continuar y finalizar la venta." 
                                                : creditApprovalReason}
                                    </span>
                                    {!isApproved && (
                                        <div className="flex gap-2">
                                            {isWaitingApproval ? (
                                                <>
                                                    <Button size="sm" variant="outline" onClick={cancelApprovalRequest} className="border-warning/30 text-warning hover:bg-warning/10">
                                                        Cancelar
                                                    </Button>
                                                    {approvalTaskId && (
                                                        <Button size="sm" onClick={() => checkApprovalStatus(approvalTaskId, false)} className="bg-warning hover:bg-warning text-white border-none shadow-sm">
                                                            Verificar Estado
                                                        </Button>
                                                    )}
                                                </>
                                            ) : (
                                                <>
                                                    <Button size="sm" variant="outline" onClick={cancelApprovalRequest} className="border-warning/30 text-warning hover:bg-warning/10">
                                                        Ajustar
                                                    </Button>
                                                    {canDirectApprove && (
                                                        <Button size="sm" variant="secondary" onClick={handleDirectApproval} className="bg-warning hover:bg-warning text-white border-none shadow-sm">
                                                            Aprobar
                                                        </Button>
                                                    )}
                                                    <Button size="sm" onClick={handleRequestApproval} className="bg-primary hover:bg-primary/90 text-white shadow-sm">
                                                        Solicitar
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </AlertDescription>
                            </Alert>
                        )}

                        {securityErrorMessage && (
                            <Alert className="mb-4 border border-destructive/50 bg-destructive/5">
                                <ShieldAlert className="h-4 w-4 text-destructive" />
                                <AlertTitle className="font-bold text-destructive">Alerta de Seguridad</AlertTitle>
                                <AlertDescription className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-2">
                                    <span className="text-sm text-destructive/80">{securityErrorMessage}</span>
                                    <Button 
                                        size="sm" 
                                        variant="outline" 
                                        onClick={() => {
                                            setSecurityErrorMessage(null)
                                            setApprovalTaskId(null)
                                            setIsApproved(false)
                                            setIsWaitingApproval(false)
                                            setCreditApprovalRequired(false)
                                        }} 
                                        className="border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0"
                                    >
                                        Entendido
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        )}
                        
                        <div className={((creditApprovalRequired || isWaitingApproval) && !isApproved) || securityErrorMessage ? "opacity-30 pointer-events-none" : ""}>
                            {renderStep()}
                        </div>
                    </>
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
                            {step < totalSteps && (
                                <Button 
                                    onClick={handleNext} 
                                    className="w-40 font-bold"
                                >
                                    Siguiente
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                            {step === totalSteps && (
                                <>
                                    <Button
                                        variant="outline"
                                        className="hidden sm:flex items-center gap-2"
                                        onClick={() => {
                                            const finalState = {
                                                step: step,
                                                dteData,
                                                paymentData,
                                                deliveryData,
                                                isApproved,
                                                isLoading: false,
                                                selectedCustomerId,
                                                selectedCustomerName,
                                                isQuickSale: quickSale,
                                                isWaitingPayment: true
                                            };
                                            onSuspend?.(finalState);
                                        }}
                                        disabled={loading}
                                    >
                                        Pagar en otro terminal
                                    </Button>
                                    <Button
                                        onClick={handleFinish}
                                        disabled={loading || isWaitingApproval}
                                        className="w-48 bg-success font-bold"
                                    >
                                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                        Finalizar Venta
                                    </Button>
                                </>
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

            <PINPadModal
                open={pinModalOpen}
                onOpenChange={setPinModalOpen}
                onConfirm={(pin) => {
                    setPinModalOpen(false)
                    executeCheckout(pin)
                }}
            />

            <BaseModal
                open={!!manualTerminalReason}
                onOpenChange={handleManualTerminalCancel}
                title="Aviso de Registro Manual"
                size="sm"
            >
                {manualTerminalReason && (
                    <ManualTerminalNotice
                        reason={manualTerminalReason}
                        amount={currentTotal}
                        paymentMethodName={paymentData.method ?? undefined}
                        failureReason={manualTerminalFailureReason ?? undefined}
                        onConfirm={handleManualTerminalConfirm}
                        onCancel={handleManualTerminalCancel}
                        onSwitchPaymentMethod={handleSwitchPaymentMethod}
                        isLoading={loading}
                        requiresInvoiceReminder={dteData.isPending}
                    />
                )}
            </BaseModal>

            <BaseModal
                open={showInvoiceReminder}
                onOpenChange={(open) => {
                    if (!open) {
                        setShowInvoiceReminder(false)
                    }
                }}
                title="Atención: Factura Pendiente"
                size="sm"
            >
                <div className="flex flex-col items-center gap-6 py-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-sm border border-destructive/30 bg-destructive/10">
                        <FileWarning className="h-8 w-8 text-destructive" />
                    </div>
                    <div className="text-center space-y-2">
                        <h4 className="font-heading text-lg font-black uppercase tracking-tight text-foreground">
                            Emitir Factura
                        </h4>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Al finalizar el cobro, ten presente que marcaste la <b>Factura</b> para ser emitida posteriormente.
                            <br/><br/>
                            No olvides emitirla externamente e ingresarle los folios al sistema una vez concluido el servicio.
                        </p>
                    </div>
                    <div className="w-full pt-4">
                        <Button
                            variant="default"
                            className="w-full h-12 font-bold uppercase tracking-widest text-xs rounded-sm shadow-lg shadow-primary/20"
                            onClick={() => {
                                setShowInvoiceReminder(false)
                                if (isSessionHost) {
                                    setPinModalOpen(true)
                                } else {
                                    executeCheckout()
                                }
                            }}
                        >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Entendido, Ir a Pagar
                        </Button>
                    </div>
                </div>
            </BaseModal>

        </div>
    )
}
