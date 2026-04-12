"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { Button } from "@/components/ui/button"
import { Step2_PurchaseDTE } from "./checkout/Step2_PurchaseDTE"
import { Step3_PurchasePayment } from "./checkout/Step3_PurchasePayment"
import { Step4_Receipt } from "./checkout/Step4_Receipt"
import { PurchaseOrderSummaryCard } from "./checkout/PurchaseOrderSummaryCard"
import { PurchaseProcessSummarySidebar } from "./checkout/PurchaseProcessSummarySidebar"
import { toast } from "sonner"
import api from "@/lib/api"

import { PricingUtils } from "@/lib/pricing"
import { Step0_Supplier } from "./checkout/Step0_Supplier"
import { Step1_ProductSelection } from "./checkout/Step1_ProductSelection"
import { Check, ChevronRight, ChevronLeft, Loader2, ShoppingCart } from "lucide-react"
import { useTreasuryAccounts } from "@/hooks/useTreasuryAccounts"
import { useServerDate } from "@/hooks/useServerDate"

interface PurchaseCheckoutWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: any | null
    orderLines: any[]
    total: number
    onComplete: () => void
    initialSupplierId?: string | null
    initialWarehouseId?: string
    orderId?: number | null
}

export function PurchaseCheckoutWizard({
    open,
    onOpenChange,
    order,
    orderLines,
    total,
    onComplete,
    initialSupplierId = null,
    initialWarehouseId = "",
    orderId = null
}: PurchaseCheckoutWizardProps) {
    const [internalOrder, setInternalOrder] = useState<any>(order)
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [currentOrderLines, setCurrentOrderLines] = useState<any[]>(orderLines)
    const [currentTotal, setCurrentTotal] = useState(total)
    const { dateString } = useServerDate()

    // Sync internal order if prop changes
    useEffect(() => {
        if (order) setInternalOrder(order)
    }, [order])

    // Fetch order if orderId is provided and no order prop
    useEffect(() => {
        if (open && orderId && !order) {
            const fetchOrder = async () => {
                setLoading(true)
                try {
                    const response = await api.get(`/purchasing/orders/${orderId}/`)
                    const data = response.data
                    setInternalOrder(data)

                    const mappedLines = (data.lines || []).map((l: any) => ({
                        id: l.id,
                        product: l.product,
                        product_name: l.product_name,
                        qty: l.quantity,
                        quantity: l.quantity,
                        unit_cost: l.unit_cost,
                        uom: l.uom,
                        uom_name: l.uom_name,
                        tax_rate: l.tax_rate || 19,
                        product_type: l.product_type
                    }))
                    setCurrentOrderLines(mappedLines)
                    setCurrentTotal(parseFloat(data.total))
                    setSelectedSupplierId(data.supplier?.toString() || null)
                    setSelectedWarehouseId(data.warehouse?.toString() || "")
                } catch (error) {
                    console.error("Error fetching order in wizard:", error)
                    toast.error("Error al cargar la orden")
                } finally {
                    setLoading(false)
                }
            }
            fetchOrder()
        }
    }, [open, orderId, order])

    useEffect(() => {
        if (open) {
            setCurrentOrderLines(orderLines)
            setCurrentTotal(total)
            setStep(1)
        }
        // We ideally only want this to run once when the wizard opens.
        // If orderLines or total change from the parent while open, 
        // we might reset the user's progress in Step 1, which is what we are avoiding.
    }, [open])

    const [dteData, setDteData] = useState({
        type: 'FACTURA',
        number: '',
        date: '',
        attachment: null,
        isPending: false
    })
    const [isFolioValid, setIsFolioValid] = useState(true)

    const [isPeriodValid, setIsPeriodValid] = useState(true)

    // Sync DTE date with server date
    useEffect(() => {
        if (dateString) {
            setDteData(prev => ({ ...prev, date: dateString }))
        }
    }, [dateString])

    useEffect(() => {
        const isExempt = dteData.type === 'FACTURA_EXENTA' || dteData.type === 'BOLETA_EXENTA';
        const newTotal = currentOrderLines.reduce((sum, line) => {
            const net = ((Number(line.quantity || line.qty) || 0) * (Number(line.unit_cost) || 0))
            const tax = isExempt ? 0 : PricingUtils.calculateTax(net)
            return sum + net + tax
        }, 0)
        setCurrentTotal(newTotal)
    }, [currentOrderLines, dteData.type])

    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(initialSupplierId)
    const [selectedSupplierName, setSelectedSupplierName] = useState("")
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null)
    const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialWarehouseId)
    const [selectedWarehouseName, setSelectedWarehouseName] = useState("")

    const [paymentData, setPaymentData] = useState({
        method: '',
        amount: total,
        transactionNumber: '',
        treasuryAccountId: null,
        isPending: false
    })

    const [receiptData, setReceiptData] = useState<any>({
        type: 'IMMEDIATE',
        deliveryReference: '',
        notes: '',
        partialQuantities: []
    })

    // Determine if the order is exclusively for subscriptions
    const isOnlySubscriptions = currentOrderLines.length > 0 && currentOrderLines.every(l => l.product_type === 'SUBSCRIPTION')
    const totalSteps = isOnlySubscriptions ? 4 : 5

    // Update payment amount when total changes
    useEffect(() => {
        setPaymentData(prev => ({ ...prev, amount: currentTotal }))
    }, [currentTotal])

    // Fetch warehouse name when ID changes
    useEffect(() => {
        if (selectedWarehouseId) {
            const fetchWarehouseName = async () => {
                try {
                    const response = await api.get(`/inventory/warehouses/${selectedWarehouseId}/`)
                    setSelectedWarehouseName(response.data.name)
                } catch (error) {
                    console.error("Failed to fetch warehouse name", error)
                }
            }
            fetchWarehouseName()
        }
    }, [selectedWarehouseId])

    const { accounts } = useTreasuryAccounts({
        context: 'GENERAL'
    })

    const validateCurrentStep = async (targetStep: number) => {
        if (targetStep === 1) {
            if (!selectedSupplierId) {
                toast.error("Debe seleccionar un proveedor para continuar.")
                return false
            }
        }
        if (targetStep === 2) {
            if (currentOrderLines.length === 0) {
                toast.error("Debe seleccionar al menos un producto.")
                return false
            }
            const invalidLine = currentOrderLines.find(l => !l.product && !l.id)
            if (invalidLine) {
                toast.error("Todos las líneas deben tener un producto seleccionado.")
                return false
            }
        }
        if (targetStep === 3 && dteData.type === 'FACTURA' && !dteData.isPending) {
            if (!dteData.attachment) {
                toast.error("Debe adjuntar el archivo de la factura.")
                return false
            }
            if (!dteData.number) {
                toast.error("Debe ingresar el número de folio de la factura.")
                return false
            }
        }

        // Tax Period Validation (Handled visually in live, but enforced here)
        if (targetStep === 3 && !dteData.isPending && dteData.date) {
            if (!isPeriodValid) {
                toast.error(`No se puede continuar. El periodo ya se encuentra cerrado.`)
                return false
            }
        }

        if (targetStep === 3 && dteData.type === 'BOLETA' && !dteData.isPending && !dteData.number) {
            toast.error("Debe ingresar el número de folio de la boleta.")
            return false
        }
        if (targetStep === 4 && paymentData.amount > 0) {
            // Check if payment method is selected
            if (!paymentData.method) {
                toast.error("Debe seleccionar un método de pago para continuar.")
                return false
            }

            // Validate at least one account exists for the selected method
            const hasAccountsForMethod = (method: string) => {
                if (method === 'CASH') return accounts.some(a => a.allows_cash)
                if (method === 'CARD') return accounts.some(a => a.allows_card)
                if (method === 'TRANSFER') return accounts.some(a => a.allows_transfer)
                return false
            }

            if (accounts.length === 0) {
                toast.error("No se puede continuar: No hay cuentas de tesorería configuradas.")
                return false
            }

            if (!hasAccountsForMethod(paymentData.method)) {
                toast.error(`El método ${paymentData.method} no tiene una cuenta de tesorería asociada.`)
                return false
            }

            if (paymentData.method && !paymentData.treasuryAccountId) {
                toast.error("Debe seleccionar una cuenta de tesorería / caja origen.")
                return false
            }
            if (paymentData.method === 'TRANSFER' && !paymentData.isPending && !paymentData.transactionNumber) {
                toast.error("Debe ingresar el número de transferencia o marcar como pendiente.")
                return false
            }
        }
        return true
    }

    const handleNext = async () => {
        const isValid = await validateCurrentStep(step)
        if (!isValid) return

        if (step === 3 && !dteData.isPending && !isFolioValid) {
            toast.error("El número de folio ya ha sido utilizado para este proveedor. Ingrese uno válido para continuar.")
            return
        }

        setStep(prev => prev + 1)
    }

    const handleBack = () => setStep(prev => prev - 1)

    const handleFinish = async () => {
        if (!selectedSupplierId) {
            toast.error("Debe seleccionar un proveedor.")
            setStep(1)
            return
        }

        setLoading(true)
        try {
            const formData = new FormData()

            // Order data
            const payloadOrder = {
                id: internalOrder?.id, // Present if editing existing draft
                supplier: selectedSupplierId ? parseInt(selectedSupplierId) : 0,
                warehouse: selectedWarehouseId ? parseInt(selectedWarehouseId) : null,
                work_order: selectedWorkOrderId ? parseInt(selectedWorkOrderId) : null,
                lines: currentOrderLines.map(l => ({
                    id: l.id, // Important for matching existing lines in backend
                    product: l.product,
                    quantity: l.qty || l.quantity,
                    unit_cost: l.unit_cost || 0,
                    uom: l.uom,
                    tax_rate: (dteData.type === 'FACTURA_EXENTA' || dteData.type === 'BOLETA_EXENTA') ? 0 : 19
                }))
            }
            formData.append('order_data', JSON.stringify(payloadOrder))

            // DTE data
            formData.append('dte_type', dteData.type)
            if (dteData.number) formData.append('document_number', dteData.number)
            if (dteData.date) formData.append('document_date', dteData.date)
            if (dteData.attachment) formData.append('document_attachment', dteData.attachment)
            formData.append('is_pending_registration', dteData.isPending.toString())

            // Payment data
            if (paymentData.amount > 0) {
                formData.append('payment_method', paymentData.method)
                formData.append('amount', paymentData.amount.toString())
                formData.append('payment_is_pending', paymentData.isPending.toString())
                if (paymentData.transactionNumber) formData.append('transaction_number', paymentData.transactionNumber)
                if (paymentData.treasuryAccountId) formData.append('treasury_account_id', paymentData.treasuryAccountId)
                formData.append('payment_type', 'OUTBOUND')
            } else {
                // Implicit credit - no payment
                formData.append('payment_method', 'CREDIT')
                formData.append('amount', '0')
            }

            // Receipt data
            if (isOnlySubscriptions) {
                formData.append('receipt_type', 'IMMEDIATE')
                formData.append('receipt_data', JSON.stringify({
                    delivery_reference: 'Auto-compleción suscripción',
                    notes: 'Procesado automáticamente para suscripción'
                }))
            } else {
                formData.append('receipt_type', receiptData.type)
                const receiptPayload: any = {
                    delivery_reference: receiptData.deliveryReference,
                    notes: receiptData.notes
                }

                // Add partial quantities if applicable
                if (receiptData.type === 'PARTIAL' && receiptData.partialQuantities) {
                    receiptPayload.line_data = receiptData.partialQuantities.map((pq: any) => ({
                        line_id: pq.lineId,
                        product_id: pq.productId,
                        quantity: pq.receivedQty,
                        uom: pq.uom
                    }))
                }

                formData.append('receipt_data', JSON.stringify(receiptPayload))
            }

            await api.post('/purchasing/orders/purchase_checkout/', formData)

            toast.success("Compra procesada correctamente")
            onComplete()
            onOpenChange(false)
        } catch (error: unknown) {
            console.error("Checkout error:", error)
            showApiError(error, "Error al procesar la compra")
        } finally {
            setLoading(false)
        }
    }

    // const totalSteps = 5 -- calculated dynamically now

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
                    <div className="p-3 bg-primary/10 rounded-lg">
                        <ShoppingCart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <span className="font-black tracking-tighter uppercase block">Procesar Compra</span>
                    </div>
                </div>
            }
            footer={
                <div className="w-full flex justify-between">
                    <Button
                        variant="outline"
                        onClick={handleBack}
                        disabled={step === 1 || loading}
                        className="h-12 px-6 font-bold"
                    >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Atrás
                    </Button>

                    {step < totalSteps ? (
                        <Button 
                            onClick={handleNext} 
                            className="w-40 h-12 font-bold"
                            disabled={step === 3 && !dteData.isPending && (!isFolioValid || !isPeriodValid)}
                        >
                            Siguiente
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleFinish}
                            className="w-48 h-12 bg-success hover:bg-success font-bold"
                            disabled={loading}
                        >
                            {loading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <Check className="mr-2 h-4 w-4" />
                            )}
                            Finalizar Compra
                        </Button>
                    )}
                </div>
            }
        >
            <div className="flex flex-1 overflow-hidden h-full">
                {/* Left Sidebar - Process Summary */}
                <PurchaseProcessSummarySidebar
                    currentStep={step}
                    totalSteps={totalSteps}
                    supplierName={selectedSupplierName}
                    warehouseName={selectedWarehouseName}
                    dteType={step > 2 ? dteData.type : undefined}
                    paymentData={step > 3 ? {
                        method: paymentData.method as any,
                        amount: paymentData.amount,
                        pendingDebt: currentTotal - paymentData.amount
                    } : undefined}
                    receiptData={step > 4 ? receiptData : undefined}
                />

                {/* Center - Content Area Wrapper */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Scrollable Content */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {step === 1 && (
                            <Step0_Supplier
                                selectedSupplierId={selectedSupplierId}
                                setSelectedSupplierId={setSelectedSupplierId}
                                setSelectedSupplierName={setSelectedSupplierName}
                                selectedWorkOrderId={selectedWorkOrderId}
                                setSelectedWorkOrderId={setSelectedWorkOrderId}
                            />
                        )}
                        {step === 2 && (
                            <Step1_ProductSelection
                                orderLines={currentOrderLines}
                                setOrderLines={setCurrentOrderLines}
                                selectedWarehouseId={selectedWarehouseId}
                                onWarehouseChange={setSelectedWarehouseId}
                                selectedSupplierId={selectedSupplierId}
                            />
                        )}
                        {step === 3 && (
                            <Step2_PurchaseDTE 
                                dteData={dteData} 
                                setDteData={setDteData} 
                                contactId={selectedSupplierId}
                                onValidityChange={(isValid) => setIsFolioValid(isValid)}
                                onPeriodValidityChange={(isValid) => setIsPeriodValid(isValid)}
                            />
                        )}
                        {step === 4 && <Step3_PurchasePayment paymentData={paymentData} setPaymentData={setPaymentData} total={currentTotal} />}
                        {step === 5 && (
                            <Step4_Receipt
                                receiptData={receiptData}
                                setReceiptData={(data) => {
                                    setReceiptData(data)
                                    if (data.warehouseId) {
                                        setSelectedWarehouseId(data.warehouseId)
                                    }
                                }}
                                orderLines={currentOrderLines}
                            />
                        )}
                    </div>
                </div>

                {/* Right Sidebar - Product Summary */}
                <div className="w-80 hidden lg:block border-l">
                    <PurchaseOrderSummaryCard
                        orderLines={currentOrderLines}
                        total={currentTotal}
                        dteType={dteData.type}
                    />
                </div>
            </div>
        </BaseModal>
    )
}
