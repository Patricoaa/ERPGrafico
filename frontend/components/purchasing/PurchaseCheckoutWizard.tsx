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
import { Step1_DTE } from "../sales/checkout/Step1_DTE"
import { Step2_PurchasePayment } from "./checkout/Step2_PurchasePayment"
import { Step3_Receipt } from "./checkout/Step3_Receipt"
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

    const [dteData, setDteData] = useState({
        type: 'FACTURA',
        number: '',
        date: new Date().toISOString().split('T')[0],
        attachment: null,
        isPending: false
    })

    const [paymentData, setPaymentData] = useState({
        method: 'CREDIT',
        amount: total,
        transactionNumber: '',
        treasuryAccountId: null,
        isPending: false
    })

    const [receiptData, setReceiptData] = useState<any>({
        type: 'IMMEDIATE',
        deliveryReference: '',
        notes: ''
    })

    const handleNext = () => {
        if (step === 1 && !selectedSupplierId) {
            toast.error("Debe seleccionar un proveedor para continuar.")
            return
        }
        if (step === 1 && !selectedWarehouseId) {
            toast.error("Debe seleccionar una bodega destino.")
            return
        }
        if (step === 2 && dteData.type === 'FACTURA' && !dteData.isPending && !dteData.number) {
            toast.error("Debe ingresar el número de folio para la factura.")
            return
        }
        if (step === 3 && paymentData.method !== 'CREDIT') {
            if ((paymentData.method === 'CARD' || paymentData.method === 'TRANSFER') && !paymentData.treasuryAccountId) {
                toast.error("Debe seleccionar una cuenta de origen.")
                return
            }
            if (paymentData.method === 'TRANSFER' && !paymentData.isPending && !paymentData.transactionNumber) {
                toast.error("Debe ingresar el número de transferencia o marcar como pendiente.")
                return
            }
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
            const payloadOrder = order ? { id: order.id } : {
                supplier: parseInt(selectedSupplierId),
                warehouse: parseInt(selectedWarehouseId),
                lines: orderLines.map(l => ({
                    product: l.id,
                    quantity: l.qty || l.quantity,
                    unit_cost: l.unit_cost || l.unit_price,
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

            // Payment data
            formData.append('payment_method', paymentData.method)
            formData.append('amount', paymentData.amount.toString())
            formData.append('payment_is_pending', paymentData.isPending.toString())
            if (paymentData.transactionNumber) formData.append('transaction_number', paymentData.transactionNumber)
            if (paymentData.treasuryAccountId) formData.append('treasury_account_id', paymentData.treasuryAccountId)

            // Receipt data
            formData.append('receipt_type', receiptData.type)
            const receiptPayload = {
                delivery_reference: receiptData.deliveryReference,
                notes: receiptData.notes
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
            <DialogContent className="sm:max-w-[95vw] lg:max-w-[1000px] p-0 overflow-hidden bg-background">
                <div className="flex h-[600px]">
                    <div className="flex-1 flex flex-col min-w-0">
                        <DialogHeader className="p-6 border-b">
                            <div className="flex items-center justify-between">
                                <DialogTitle className="text-xl font-bold">Procesar Compra</DialogTitle>
                                <div className="flex items-center gap-2">
                                    {[1, 2, 3, 4].map((s) => (
                                        <div
                                            key={s}
                                            className={`h-2 w-8 rounded-full transition-all ${step === s ? 'bg-primary w-12' : 'bg-muted'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-auto p-6">
                            {step === 1 && (
                                <Step0_Supplier
                                    selectedSupplierId={selectedSupplierId}
                                    setSelectedSupplierId={setSelectedSupplierId}
                                    setSelectedSupplierName={setSelectedSupplierName}
                                    selectedWarehouseId={selectedWarehouseId}
                                    setSelectedWarehouseId={setSelectedWarehouseId}
                                />
                            )}
                            {step === 2 && <Step1_DTE dteData={dteData} setDteData={setDteData} />}
                            {step === 3 && <Step2_PurchasePayment paymentData={paymentData} setPaymentData={setPaymentData} total={total} />}
                            {step === 4 && <Step3_Receipt receiptData={receiptData} setReceiptData={setReceiptData} />}
                        </div>

                        <DialogFooter className="p-6 border-t bg-muted/5">
                            <div className="flex justify-between w-full gap-4">
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
                        </DialogFooter>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
