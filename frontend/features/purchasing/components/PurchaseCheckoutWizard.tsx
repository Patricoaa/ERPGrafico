"use client"

import { showApiError } from "@/lib/errors"
import { useState, useEffect } from "react"

import { Button } from "@/components/ui/button"
import { Step2_PurchaseDTE } from "./checkout/Step2_PurchaseDTE"
import { Step3_PurchasePayment } from "./checkout/Step3_PurchasePayment"
import { Step4_Receipt } from "./checkout/Step4_Receipt"
import { PurchaseOrderSummaryCard } from "./checkout/PurchaseOrderSummaryCard"
import { PurchaseProcessSummarySidebar } from "./checkout/PurchaseProcessSummarySidebar"
import { toast } from "sonner"
import { purchasingApi } from "../api/purchasingApi"
import { type PurchaseOrderAPI, type PurchaseOrderLineAPI, type CheckoutLine, type DTEData, type ReceiptData } from "../types"
import { type PaymentData } from "@/features/treasury"

import { PricingUtils } from '@/lib/pricing-utils'

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID()
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
}
import { Step0_Supplier } from "./checkout/Step0_Supplier"
import { Step1_ProductSelection } from "./checkout/Step1_ProductSelection"
import { Check, ChevronRight, ChevronLeft, Loader2, ShoppingCart } from "lucide-react"
import { useVatRate } from '@/hooks/useVatRate'
import { useTreasuryAccounts } from "@/hooks/useTreasuryAccounts"
import { useServerDate } from "@/hooks/useServerDate"
import { Drawer, CancelButton, FormFooter } from '@/components/shared'
import { useRef } from "react"

interface PurchaseCheckoutWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: PurchaseOrderAPI | null
    orderLines: CheckoutLine[]
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
    const [internalOrder, setInternalOrder] = useState<PurchaseOrderAPI | null>(order)
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const idempotencyKeyRef = useRef<string>(generateUUID())
    const [currentOrderLines, setCurrentOrderLines] = useState<CheckoutLine[]>(orderLines)
    const [currentTotal, setCurrentTotal] = useState(total)
    const { dateString } = useServerDate()
    const { rate } = useVatRate()
    
    const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(initialSupplierId)
    const [selectedSupplierName, setSelectedSupplierName] = useState("")
    const [selectedWorkOrderId, setSelectedWorkOrderId] = useState<string | null>(null)
    const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialWarehouseId)
    const [selectedWarehouseName, setSelectedWarehouseName] = useState("")

    // Sync internal order if prop changes
    useEffect(() => {
        if (order) {
            requestAnimationFrame(() => {
                setInternalOrder(order)
            })
        }
    }, [order])

    // Fetch order if orderId is provided and no order prop
    useEffect(() => {
        if (open && orderId && !order) {
            const fetchOrder = async () => {
                setLoading(true)
                try {
                    const data = await purchasingApi.getOrder(orderId)
                    setInternalOrder(data)

                    const mappedLines = (data.lines || []).map((l: PurchaseOrderLineAPI) => ({
                        id: l.id,
                        product: l.product,
                        product_name: l.product_name,
                        qty: Number(l.quantity),
                        quantity: Number(l.quantity),
                        unit_cost: Number(l.unit_cost),
                        uom: l.uom,
                        uom_name: l.uom_name,
                        tax_rate: Number(l.tax_rate ?? rate),
                        product_type: l.product_type
                    }))
                    setCurrentOrderLines(mappedLines)
                    setCurrentTotal(parseFloat(data.total as string))
                    setSelectedSupplierId(typeof data.supplier === 'object' ? String((data.supplier as unknown as Record<string, unknown>).id) : String(data.supplier ?? ""))
                    setSelectedWarehouseId(data.warehouse ? (typeof data.warehouse === 'object' ? String((data.warehouse as unknown as Record<string, unknown>).id) : String(data.warehouse)) : "")
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
            requestAnimationFrame(() => {
                setCurrentOrderLines(orderLines)
                setCurrentTotal(total)
                setStep(1)
            })
        }
        // We ideally only want this to run once when the wizard opens.
        // If orderLines or total change from the parent while open, 
        // we might reset the user's progress in Step 1, which is what we are avoiding.
    }, [open])

    const [dteData, setDteData] = useState<DTEData>({
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
            requestAnimationFrame(() => {
                setDteData(prev => ({ ...prev, date: dateString }))
            })
        }
    }, [dateString])

    useEffect(() => {
        const isExempt = dteData.type === 'FACTURA_EXENTA' || dteData.type === 'BOLETA_EXENTA';
        const newTotal = currentOrderLines.reduce((sum, line) => {
            const net = ((Number(line.quantity || line.qty) || 0) * (Number(line.unit_cost) || 0))
            const tax = isExempt ? 0 : PricingUtils.calculateTax(net)
            return sum + net + tax
        }, 0)
        requestAnimationFrame(() => {
            setCurrentTotal(newTotal)
        })
    }, [currentOrderLines, dteData.type])

    const [paymentData, setPaymentData] = useState<PaymentData>({
        method: null,
        amount: total,
        treasuryAccountId: null,
        paymentMethodId: null,
        isPending: false
    })

    const [receiptData, setReceiptData] = useState<ReceiptData>({
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
        requestAnimationFrame(() => {
            setPaymentData(prev => ({ ...prev, amount: currentTotal }))
        })
    }, [currentTotal])

    // Fetch warehouse name when ID changes
    useEffect(() => {
        if (selectedWarehouseId) {
            const fetchWarehouseName = async () => {
                try {
                    const warehouseData = await purchasingApi.getWarehouse(selectedWarehouseId)
                    setSelectedWarehouseName(String((warehouseData as Record<string, unknown>).name ?? ''))
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
        if (targetStep === 5 && paymentData.amount > 0) {
            // Check if payment method is selected
            if (!paymentData.method) {
                toast.error("Debe seleccionar un método de pago para continuar.")
                return false
            }

            // Validate at least one account exists for the selected method
            const hasAccountsForMethod = (method: string) => {
                if (method === 'CASH') return accounts.some(a => a.allows_cash)
                if (method === 'CARD' || method === 'CREDIT_CARD') return accounts.some(a => a.allows_card)
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
            if (paymentData.method === 'CHECK') {
                if (!paymentData.checkNumber) {
                    toast.error("Debe ingresar el número de cheque.")
                    return false
                }
                if (!paymentData.checkBankId) {
                    toast.error("Debe seleccionar el banco emisor del cheque.")
                    return false
                }
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
                    tax_rate: (dteData.type === 'FACTURA_EXENTA' || dteData.type === 'BOLETA_EXENTA') ? 0 : rate
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
                formData.append('payment_method', paymentData.method || "")
                formData.append('amount', paymentData.amount.toString())
                formData.append('payment_is_pending', (paymentData.isPending || false).toString())
                if (paymentData.treasuryAccountId) formData.append('treasury_account_id', paymentData.treasuryAccountId)
                if (paymentData.paymentMethodId) formData.append('payment_method_id', paymentData.paymentMethodId.toString())
                if (paymentData.method === 'CHECK' && paymentData.checkNumber) formData.append('check_number', paymentData.checkNumber)
                if (paymentData.method === 'CHECK' && paymentData.checkBankId) formData.append('check_bank_id', paymentData.checkBankId.toString())
                if (paymentData.method === 'CHECK' && paymentData.checkDueDate) formData.append('check_due_date', paymentData.checkDueDate)
                if (paymentData.installments && paymentData.installments > 1) {
                    formData.append('installments', paymentData.installments.toString())
                }
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
                const receiptPayload: Record<string, unknown> = {
                    delivery_reference: receiptData.deliveryReference,
                    notes: receiptData.notes
                }

                // Add partial quantities if applicable
                if (receiptData.type === 'PARTIAL' && receiptData.partialQuantities) {
                    receiptPayload.line_data = receiptData.partialQuantities.map((pq) => ({
                        line_id: pq.lineId,
                        product_id: pq.productId,
                        quantity: pq.receivedQty,
                        uom: pq.uom
                    }))
                }

                formData.append('receipt_data', JSON.stringify(receiptPayload))
            }

            await purchasingApi.createOrder(formData, idempotencyKeyRef.current)
            idempotencyKeyRef.current = generateUUID()

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
        <Drawer
            open={open}
            onOpenChange={onOpenChange}
            icon={ShoppingCart}
            title="Procesar Compra"
            description="Asistente de compra rápida, facturación y recepción de inventario."
            side="bottom"
            defaultSize="100%"
            boundary="embedded"
            contentClassName="p-0 flex flex-col"
            headerClassName="border-b pb-2 px-6 py-3"
            footer={
                <FormFooter
                    leftActions={
                        step > 1 ? (
                            <CancelButton
                                onClick={handleBack}
                                disabled={loading}
                            >
                                <ChevronLeft className="mr-1.5 h-3.5 w-3.5" />
                                Atrás
                            </CancelButton>
                        ) : undefined
                    }
                    actions={
                        step < totalSteps ? (
                            <Button 
                                onClick={handleNext} 
                                className="w-40"
                                disabled={step === 3 && !dteData.isPending && (!isFolioValid || !isPeriodValid)}
                            >
                                Siguiente
                                <ChevronRight className="ml-2 h-4 w-4" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleFinish}
                                className="w-48 bg-success hover:bg-success/90 text-success-foreground font-bold transition-all shadow-elevated shadow-success/20"
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <Check className="mr-2 h-4 w-4" />
                                )}
                                Finalizar Compra
                            </Button>
                        )
                    }
                />
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
                    receiptData={step > 3 ? receiptData : undefined}
                    paymentData={step > 4 ? {
                        method: paymentData.method,
                        amount: paymentData.amount,
                        pendingDebt: currentTotal - paymentData.amount
                    } : undefined}
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
                        {step === 4 && (
                            <Step4_Receipt
                                receiptData={receiptData}
                                setReceiptData={(data) => {
                                    setReceiptData(data)
                                    if (typeof data !== 'function' && data.warehouseId) {
                                        setSelectedWarehouseId(data.warehouseId)
                                    }
                                }}
                                orderLines={currentOrderLines}
                            />
                        )}
                        {step === 5 && <Step3_PurchasePayment paymentData={paymentData} setPaymentData={setPaymentData} total={currentTotal} />}
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
        </Drawer>
    )
}
