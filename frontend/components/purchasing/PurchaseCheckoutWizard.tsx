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
import { Step1_PurchaseDTE } from "./checkout/Step1_PurchaseDTE"
import { Step2_PurchasePayment } from "./checkout/Step2_PurchasePayment"
import { Step3_Receipt } from "./checkout/Step3_Receipt"
import { PurchaseOrderSummaryCard } from "./checkout/PurchaseOrderSummaryCard"
import { PurchaseProcessSummarySidebar } from "./checkout/PurchaseProcessSummarySidebar"
import { toast } from "sonner"
import api from "@/lib/api"
import { Step0_Supplier } from "./checkout/Step0_Supplier"
import { Check, ChevronRight, ChevronLeft, Loader2 } from "lucide-react"

interface PurchaseCheckoutWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: any | null
    orderLines: any[]
    total: number
    onComplete: () => void
    initialSupplierId?: string
    initialWarehouseId?: string
}

export function PurchaseCheckoutWizard({
    open,
    onOpenChange,
    order,
    orderLines,
    total,
    onComplete,
    initialSupplierId = "",
    initialWarehouseId = ""
}: PurchaseCheckoutWizardProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    const [selectedSupplierId, setSelectedSupplierId] = useState(initialSupplierId)
    const [selectedSupplierName, setSelectedSupplierName] = useState("")
    const [selectedWarehouseId, setSelectedWarehouseId] = useState(initialWarehouseId)
    const [selectedWarehouseName, setSelectedWarehouseName] = useState("")

    const [dteData, setDteData] = useState({
        type: 'FACTURA',
        number: '',
        date: new Date().toISOString().split('T')[0],
        attachment: null,
        isPending: false
    })

    const [paymentData, setPaymentData] = useState({
        method: 'CASH',
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

    // Update payment amount when total changes
    useEffect(() => {
        setPaymentData(prev => ({ ...prev, amount: total }))
    }, [total])

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

    const [accounts, setAccounts] = useState<any[]>([])

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const response = await api.get('/treasury/accounts/')
                const results = response.data.results || response.data
                setAccounts(results)
            } catch (error) {
                console.error("Failed to fetch treasury accounts", error)
            }
        }
        fetchAccounts()
    }, [])

    const validateCurrentStep = (targetStep: number) => {
        if (targetStep === 1) {
            if (!selectedSupplierId) {
                toast.error("Debe seleccionar un proveedor para continuar.")
                return false
            }
            if (!selectedWarehouseId) {
                toast.error("Debe seleccionar una bodega destino.")
                return false
            }
        }
        if (targetStep === 2 && dteData.type === 'FACTURA' && !dteData.isPending) {
            if (!dteData.attachment) {
                toast.error("Debe adjuntar el archivo de la factura.")
                return false
            }
            if (!dteData.number) {
                toast.error("Debe ingresar el número de folio de la factura.")
                return false
            }
        }
        if (targetStep === 2 && dteData.type === 'BOLETA' && !dteData.isPending && !dteData.number) {
            toast.error("Debe ingresar el número de folio de la boleta.")
            return false
        }
        if (targetStep === 3 && paymentData.amount > 0) {
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

            if ((paymentData.method === 'CARD' || paymentData.method === 'TRANSFER') && !paymentData.treasuryAccountId) {
                toast.error("Debe seleccionar una cuenta de destino.")
                return false
            }
            if (paymentData.method === 'TRANSFER' && !paymentData.isPending && !paymentData.transactionNumber) {
                toast.error("Debe ingresar el número de transferencia o marcar como pendiente.")
                return false
            }
        }
        return true
    }

    const handleNext = () => {
        if (!validateCurrentStep(step)) return
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
            const payloadOrder = order ? { id: order.id } : {
                supplier: parseInt(selectedSupplierId),
                warehouse: parseInt(selectedWarehouseId),
                lines: orderLines.map(l => ({
                    product: l.id,
                    quantity: l.qty || l.quantity,
                    unit_cost: l.unit_cost || 0,
                    uom: l.uom,
                    tax_rate: 19
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
            } else {
                // Implicit credit - no payment
                formData.append('payment_method', 'CREDIT')
                formData.append('amount', '0')
            }

            // Receipt data
            formData.append('receipt_type', receiptData.type)
            const receiptPayload: any = {
                delivery_reference: receiptData.deliveryReference,
                notes: receiptData.notes
            }

            // Add partial quantities if applicable
            if (receiptData.type === 'PARTIAL' && receiptData.partialQuantities) {
                receiptPayload.line_data = receiptData.partialQuantities.map((pq: any) => ({
                    product_id: pq.productId,
                    quantity: pq.receivedQty
                }))
            }

            formData.append('receipt_data', JSON.stringify(receiptPayload))

            await api.post('/purchasing/orders/purchase_checkout/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            toast.success("Compra procesada correctamente")
            onComplete()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Checkout error:", error)
            toast.error(error.response?.data?.error || "Error al procesar la compra")
        } finally {
            setLoading(false)
        }
    }

    const totalSteps = 4

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[1400px] w-[95vw] min-h-[85vh] max-h-[90vh] overflow-hidden flex flex-col p-0">
                <div className="p-6 border-b flex justify-between items-center bg-muted/30">
                    <div>
                        <DialogTitle className="text-2xl">Procesar Compra</DialogTitle>
                    </div>
                    <div className="flex items-center gap-2">
                        {[1, 2, 3, 4].map((s) => (
                            <div
                                key={s}
                                className={`h-2 w-8 rounded-full transition-all ${step === s ? 'bg-primary w-12' : 'bg-muted'}`}
                            />
                        ))}
                    </div>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Left Sidebar - Process Summary */}
                    <PurchaseProcessSummarySidebar
                        currentStep={step}
                        totalSteps={totalSteps}
                        supplierName={selectedSupplierName}
                        warehouseName={selectedWarehouseName}
                        dteType={step > 1 ? dteData.type : undefined}
                        paymentData={step > 2 ? {
                            method: paymentData.method,
                            amount: paymentData.amount,
                            pendingDebt: total - paymentData.amount
                        } : undefined}
                        receiptData={step > 3 ? receiptData : undefined}
                    />

                    {/* Center - Content Area */}
                    <div className="flex-1 flex flex-col p-6 overflow-y-auto">
                        {step === 1 && (
                            <Step0_Supplier
                                selectedSupplierId={selectedSupplierId}
                                setSelectedSupplierId={setSelectedSupplierId}
                                setSelectedSupplierName={setSelectedSupplierName}
                                selectedWarehouseId={selectedWarehouseId}
                                setSelectedWarehouseId={setSelectedWarehouseId}
                            />
                        )}
                        {step === 2 && <Step1_PurchaseDTE dteData={dteData} setDteData={setDteData} />}
                        {step === 3 && <Step2_PurchasePayment paymentData={paymentData} setPaymentData={setPaymentData} total={total} />}
                        {step === 4 && <Step3_Receipt receiptData={receiptData} setReceiptData={setReceiptData} orderLines={orderLines} />}

                        {/* Progress Buttons */}
                        <div className="mt-8 pt-6 border-t flex justify-between">
                            <Button
                                variant="ghost"
                                onClick={handleBack}
                                disabled={step === 1 || loading}
                            >
                                <ChevronLeft className="mr-2 h-4 w-4" />
                                Atrás
                            </Button>

                            {step < totalSteps ? (
                                <Button onClick={handleNext} className="w-40">
                                    Siguiente
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleFinish}
                                    className="w-48 bg-emerald-600 hover:bg-emerald-700"
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
                    </div>

                    {/* Right Sidebar - Product Summary */}
                    <div className="w-80 hidden lg:block">
                        <PurchaseOrderSummaryCard
                            orderLines={orderLines}
                            total={total}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
