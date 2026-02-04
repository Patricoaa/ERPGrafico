"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog"
import { BaseModal } from "@/components/shared/BaseModal"
import { PricingUtils } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Step1_DTE } from "./checkout/Step1_DTE"
import { Step2_Payment } from "./checkout/Step2_Payment"
import { useTreasuryAccounts } from "@/hooks/useTreasuryAccounts"
import { Step3_Delivery } from "./checkout/Step3_Delivery"
import { Step2_ManufacturingDetails } from "./checkout/Step2_ManufacturingDetails"
import { OrderSummaryCard } from "./checkout/OrderSummaryCard"
import { ProcessSummarySidebar } from "./checkout/ProcessSummarySidebar"
import { toast } from "sonner"
import api from "@/lib/api"
import { Step0_Customer } from "./checkout/Step0_Customer"
import { Check, ChevronRight, ChevronLeft, Loader2, Paintbrush, ShoppingCart } from "lucide-react"

// ... other imports

interface SalesCheckoutWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: any | null
    orderLines: any[]
    total: number
    onComplete: () => void
    customerName?: string  // Optional for backward compatibility
    initialCustomerName?: string
    initialCustomerId?: string
    channel?: string
    posSessionId?: number | null // POS session ID for cash control
    terminalId?: number // Terminal ID for filtering accounts
}

export function SalesCheckoutWizard({
    open,
    onOpenChange,
    order,
    orderLines: initialOrderLines,
    total: initialTotal,
    onComplete,
    initialCustomerName = "",
    initialCustomerId = "",
    channel = "POS",
    posSessionId = null,
    terminalId
}: SalesCheckoutWizardProps) {
    const [step, setStep] = useState(1)
    const [loading, setLoading] = useState(false)
    const [currentOrderLines, setCurrentOrderLines] = useState(initialOrderLines)

    // Recalculate total if currentOrderLines changes (Gross total including 19% tax)
    const currentTotal = currentOrderLines.reduce((acc: number, line: any) => {
        if (line.total_gross !== undefined) return acc + line.total_gross;
        const net = PricingUtils.calculateLineNet(line.qty || line.quantity, line.unit_price_net || line.unit_price);
        return acc + PricingUtils.netToGross(net);
    }, 0);

    const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomerId)
    const [selectedCustomerName, setSelectedCustomerName] = useState(initialCustomerName)

    const [dteData, setDteData] = useState({
        type: 'BOLETA',
        number: '',
        date: new Date().toISOString().split('T')[0],
        attachment: null,
        isPending: false
    })

    const [paymentData, setPaymentData] = useState({
        method: '',
        amount: initialTotal,
        transactionNumber: '',
        treasuryAccountId: null,
        isPending: false
    })

    // Sync payment amount when total changes
    useEffect(() => {
        setPaymentData(prev => ({ ...prev, amount: currentTotal }));
    }, [currentTotal]);

    const [deliveryData, setDeliveryData] = useState<any>({
        type: 'IMMEDIATE',
        date: null,
        notes: ''
    })

    const hasManufacturing = currentOrderLines.some((line: any) =>
        (line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing) ||
        (line.product_type === 'MANUFACTURABLE' && !line.has_bom)
    );

    // Auto-suggest delivery date if fabricable (includes any mfg or BOM)
    useEffect(() => {
        const fabricableLines = currentOrderLines.filter((line: any) =>
            ((line.product_type === 'MANUFACTURABLE' || line.has_bom) && !line.mfg_auto_finalize)
        );

        if (fabricableLines.length > 0) {
            setDeliveryData((prev: any) => ({ ...prev, type: 'SCHEDULED' }));

            // Get the maximum default delivery days from the products
            const maxDays = fabricableLines.reduce((max, line) => {
                const days = line.mfg_default_delivery_days || 5;
                return Math.max(max, days);
            }, 0);

            // Suggest +maxDays
            const suggestedDate = new Date();
            suggestedDate.setDate(suggestedDate.getDate() + maxDays);
            setDeliveryData((prev: any) => ({ ...prev, date: suggestedDate.toISOString().split('T')[0] }));
        }
    }, [currentOrderLines]);

    // Fetch default customer if none provided
    useEffect(() => {
        if (!initialCustomerId && open) {
            const fetchDefaultCustomer = async () => {
                try {
                    const response = await api.get('/contacts/?is_default_customer=true');
                    const results = response.data.results || response.data;
                    const defaultCustomer = results.find((c: any) => c.is_default_customer);
                    if (defaultCustomer) {
                        setSelectedCustomerId(defaultCustomer.id.toString());
                        setSelectedCustomerName(defaultCustomer.name);
                    }
                } catch (error) {
                    console.error("Error fetching default customer:", error);
                }
            };
            fetchDefaultCustomer();
        }
    }, [initialCustomerId, open]);

    // Treasury accounts for validation
    const { accounts } = useTreasuryAccounts({
        context: terminalId ? 'POS' : 'GENERAL',
        terminalId
    })

    const isOnlyService = currentOrderLines.every((line: any) => line.product_type === 'SERVICE');
    const totalSteps = (isOnlyService ? 3 : 4) + (hasManufacturing ? 1 : 0);

    // Map internal step to components
    const renderStep = () => {
        let currentStepNum = 1;

        // Step 1: Customer
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

        // Optional Step 2: Manufacturing
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

        // Step: DTE
        if (step === currentStepNum) {
            return <Step1_DTE dteData={dteData} setDteData={setDteData} />
        }
        currentStepNum++;

        // Step: Payment
        if (step === currentStepNum) {
            return <Step2_Payment paymentData={paymentData} setPaymentData={setPaymentData} total={currentTotal} terminalId={terminalId} />
        }
        currentStepNum++;

        // Step: Delivery
        if (!isOnlyService && step === currentStepNum) {
            return <Step3_Delivery deliveryData={deliveryData} setDeliveryData={setDeliveryData} orderLines={currentOrderLines} />
        }

        return null;
    }

    const validateCurrentStep = async () => {
        // Find which logical step we are in
        let currentStepNum = 1;

        // Customer validation
        if (step === currentStepNum) {
            if (!selectedCustomerId) {
                toast.error("Debe seleccionar un cliente para continuar.")
                return false
            }
            return true
        }
        currentStepNum++;

        // Manufacturing validation
        if (hasManufacturing) {
            if (step === currentStepNum) {
                // Check if all mfg items have data
                const pendingItems = currentOrderLines.filter((line: any) =>
                    (line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing && !line.manufacturing_data) ||
                    (line.product_type === 'MANUFACTURABLE' && !line.has_bom && !line.manufacturing_data)
                )
                if (pendingItems.length > 0) {
                    toast.error(`Tiene ${pendingItems.length} productos sin configurar detalles de fabricación.`)
                    return false
                }
                return true
            }
            currentStepNum++;
        }


        // DTE validation
        if (step === currentStepNum) {
            if (dteData.type === 'FACTURA' && !dteData.isPending && !dteData.number) {
                toast.error("Debe ingresar el número de folio para la factura.")
                return false
            }

            // Validate folio uniqueness
            if (dteData.type === 'FACTURA' && dteData.number && !dteData.isPending) {
                try {
                    const response = await api.get('/billing/invoices/check_folio/', {
                        params: { number: dteData.number, dte_type: dteData.type }
                    })

                    if (!response.data.is_unique) {
                        toast.error("Folio duplicado", {
                            description: response.data.message
                        })
                        return false
                    }
                } catch (error) {
                    console.error('Error validating folio:', error)
                    toast.error("Error al validar el folio. Por favor, intente nuevamente.")
                    return false
                }
            }

            return true
        }
        currentStepNum++;


        // Payment validation
        if (step === currentStepNum) {
            // Check if payment method is selected
            if (!paymentData.method) {
                toast.error("Debe seleccionar un método de pago para continuar.")
                return false
            }

            const hasAccountsForMethod = (method: string) => {
                if (method === 'CASH') return accounts.some(a => a.allows_cash)
                if (method === 'CARD') return accounts.some(a => a.allows_card)
                if (method === 'TRANSFER') return accounts.some(a => a.allows_transfer)
                return false
            }

            if (paymentData.method !== 'CREDIT' && paymentData.amount > 0) {
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


        return true
    }

    const handleNext = async () => {
        if (!(await validateCurrentStep())) return
        setStep(prev => prev + 1)
    }

    const handleBack = () => setStep(prev => prev - 1)

    const handleFinish = async () => {
        // Final validation
        if (!(await validateCurrentStep())) return

        setLoading(true)
        try {
            const formData = new FormData()

            const payloadOrder = order ? { id: order.id } : {
                customer: parseInt(selectedCustomerId),
                payment_method: paymentData.method,
                channel: channel,
                lines: currentOrderLines.map((l: any) => {
                    // Clean up manufacturing_data for JSON (File objects can't be stringified)
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
                        tax_rate: 19,
                        manufacturing_data: cleanMfgData
                    }
                })
            }
            formData.append('order_data', JSON.stringify(payloadOrder))

            // Append manufacturing files per line
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

            // DTE data
            formData.append('dte_type', dteData.type)
            formData.append('is_pending_registration', dteData.isPending.toString())
            if (dteData.number) formData.append('document_number', dteData.number)
            if (dteData.date) formData.append('document_date', dteData.date)
            if (dteData.attachment) formData.append('document_attachment', dteData.attachment)

            // Payment data
            const finalPaymentMethod = paymentData.amount === 0 ? 'CREDIT' : paymentData.method
            formData.append('payment_method', finalPaymentMethod)
            formData.append('amount', paymentData.amount.toString())
            formData.append('payment_is_pending', paymentData.isPending.toString())
            if (paymentData.transactionNumber && paymentData.amount > 0) formData.append('transaction_number', paymentData.transactionNumber)
            if (paymentData.treasuryAccountId && paymentData.amount > 0) formData.append('treasury_account_id', paymentData.treasuryAccountId)
            formData.append('payment_type', 'INBOUND')

            // Delivery data
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

            // POS Session ID for cash control
            if (posSessionId) {
                formData.append('pos_session_id', posSessionId.toString())
            }

            await api.post('/billing/invoices/pos_checkout/', formData)

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
                    <div className="p-3 bg-primary/10 rounded-2xl">
                        <ShoppingCart className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <span className="font-black tracking-tighter uppercase block">Cerrar Venta</span>
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
                        <Button onClick={handleNext} className="w-40 h-12 font-bold">
                            Siguiente
                            <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    ) : (
                        <Button
                            onClick={handleFinish}
                            className="w-48 h-12 bg-emerald-600 hover:bg-emerald-700 font-bold"
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
            }
        >
            <div className="flex flex-1 overflow-hidden h-full">
                {/* Left Sidebar - Process Summary */}
                <ProcessSummarySidebar
                    currentStep={step}
                    totalSteps={totalSteps}
                    customerName={selectedCustomerName}
                    hasManufacturing={hasManufacturing}
                    dteType={step > (hasManufacturing ? 2 : 1) ? dteData.type : undefined}
                    paymentData={step > (hasManufacturing ? 3 : 2) ? {
                        method: paymentData.method,
                        amount: paymentData.amount,
                        creditAssigned: paymentData.amount < currentTotal ? currentTotal - paymentData.amount : 0
                    } : undefined}
                    deliveryData={step > (hasManufacturing ? 4 : 3) ? deliveryData : undefined}
                />

                {/* Center - Content Area Wrapper */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Scrollable Content */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {renderStep()}
                    </div>
                </div>

                {/* Right Sidebar - Product Summary */}
                <div className="w-80 border-l hidden lg:block overflow-y-auto">
                    <OrderSummaryCard
                        orderLines={currentOrderLines}
                        total={currentTotal}
                    />
                </div>
            </div>
        </BaseModal>
    )
}
