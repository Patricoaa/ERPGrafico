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
import { Step1_DTE } from "./checkout/Step1_DTE"
import { Step2_Payment } from "./checkout/Step2_Payment"
import { Step3_Delivery } from "./checkout/Step3_Delivery"
import { OrderSummaryCard } from "./checkout/OrderSummaryCard"
import { toast } from "sonner"
import api from "@/lib/api"
import { Check, ChevronRight, ChevronLeft, Loader2 } from "lucide-react"

interface SalesCheckoutWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: any | null
    orderLines: any[]
    total: number
    onComplete: () => void
    customerName?: string
}

export function SalesCheckoutWizard({
    open,
    onOpenChange,
    order,
    orderLines,
    total,
    onComplete,
    customerName
}: SalesCheckoutWizardProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)

    const [dteData, setDteData] = useState({
        type: 'BOLETA',
        number: '',
        date: new Date().toISOString().split('T')[0],
        attachment: null,
        isPending: false
    })

    const [paymentData, setPaymentData] = useState({
        method: 'CASH',
        amount: total,
        transactionNumber: '',
        treasuryAccountId: null
    })

    const [deliveryData, setDeliveryData] = useState<any>({
        type: 'IMMEDIATE',
        date: null,
        notes: ''
    })

    // Auto-suggest delivery date if fabricable
    useEffect(() => {
        const hasFabricable = orderLines.some(line => line.product_type === 'MANUFACTURABLE' || line.has_bom);
        if (hasFabricable) {
            setDeliveryData((prev: any) => ({ ...prev, type: 'SCHEDULED' }));
            // Suggest +5 days
            const suggestedDate = new Date();
            suggestedDate.setDate(suggestedDate.getDate() + 5);
            setDeliveryData((prev: any) => ({ ...prev, date: suggestedDate.toISOString().split('T')[0] }));
        }
    }, [orderLines]);

    const handleNext = () => {
        if (step === 1 && dteData.type === 'FACTURA' && !dteData.isPending && !dteData.number) {
            toast.error("Debe ingresar el número de folio para la factura.")
            return
        }
        if (step === 2 && (paymentData.method === 'CARD' || paymentData.method === 'TRANSFER') && !paymentData.treasuryAccountId) {
            toast.error("Debe seleccionar una cuenta de destino.")
            return
        }
        setStep(prev => prev + 1)
    }

    const handleBack = () => setStep(prev => prev - 1)

    const handleFinish = async () => {
        setLoading(true)
        try {
            const formData = new FormData()

            // Order data
            const payloadOrder = order ? { id: order.id } : {
                customer: (orderLines[0] as any).customer, // If it's a new order from POS, we need customer ID
                lines: orderLines.map(l => ({
                    product: l.id,
                    quantity: l.qty || l.quantity,
                    unit_price: l.unit_price_net || l.unit_price,
                    uom: l.uom,
                }))
            }
            formData.append('order_data', JSON.stringify(payloadOrder))

            // DTE data
            formData.append('dte_type', dteData.type)
            formData.append('is_pending_registration', dteData.isPending.toString())
            if (dteData.number) formData.append('document_number', dteData.number)
            if (dteData.date) formData.append('document_date', dteData.date)
            if (dteData.attachment) formData.append('document_attachment', dteData.attachment)

            // Payment data
            formData.append('payment_method', paymentData.method)
            formData.append('amount', paymentData.amount.toString())
            if (paymentData.transactionNumber) formData.append('transaction_number', paymentData.transactionNumber)
            if (paymentData.treasuryAccountId) formData.append('treasury_account_id', paymentData.treasuryAccountId)

            // Delivery data
            formData.append('delivery_type', deliveryData.type)
            if (deliveryData.date) formData.append('delivery_date', deliveryData.date)
            if (deliveryData.notes) formData.append('delivery_notes', deliveryData.notes)

            await api.post('/billing/invoices/pos_checkout/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })

            toast.success("Venta procesada correctamente")
            onComplete()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Checkout error:", error)
            toast.error(error.response?.data?.error || "Error al procesar la venta")
        } finally {
            setLoading(false)
        }
    }

    const isOnlyService = orderLines.every(line => line.product_type === 'SERVICE');
    const totalSteps = isOnlyService ? 2 : 3;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl p-0 overflow-hidden bg-background">
                <div className="flex h-[600px]">
                    {/* Main Content */}
                    <div className="flex-1 flex flex-col min-w-0">
                        <DialogHeader className="p-6 border-b">
                            <div className="flex items-center justify-between">
                                <DialogTitle className="text-xl font-bold">Cerrar Venta</DialogTitle>
                                <div className="flex items-center gap-2">
                                    {[1, 2, totalSteps].map((s) => (
                                        <div
                                            key={s}
                                            className={`h-2 w-8 rounded-full transition-all ${step === s ? 'bg-primary w-12' : 'bg-muted'}`}
                                        />
                                    ))}
                                </div>
                            </div>
                        </DialogHeader>

                        <div className="flex-1 overflow-auto p-6">
                            {step === 1 && <Step1_DTE dteData={dteData} setDteData={setDteData} />}
                            {step === 2 && <Step2_Payment paymentData={paymentData} setPaymentData={setPaymentData} total={total} />}
                            {step === 3 && <Step3_Delivery deliveryData={deliveryData} setDeliveryData={setDeliveryData} orderLines={orderLines} />}
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
                                        Finalizar Venta
                                    </Button>
                                )}
                            </div>
                        </DialogFooter>
                    </div>

                    {/* Sidebar Summary */}
                    <div className="w-80 hidden lg:block">
                        <OrderSummaryCard
                            orderLines={orderLines}
                            total={total}
                            customerName={customerName}
                        />
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
