"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
import { PricingUtils } from "@/lib/pricing"
import { Button } from "@/components/ui/button"
import { Step1_DTE } from "./checkout/Step1_DTE"
import { Step2_Payment } from "./checkout/Step2_Payment"
import { useTreasuryAccounts } from "@/hooks/useTreasuryAccounts"
import { useAllowedPaymentMethods } from "@/hooks/useAllowedPaymentMethods"
import { Step3_Delivery } from "./checkout/Step3_Delivery"
import { Step2_ManufacturingDetails } from "./checkout/Step2_ManufacturingDetails"
import { OrderSummaryCard } from "./checkout/OrderSummaryCard"
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"
import { ProcessSummarySidebar } from "./checkout/ProcessSummarySidebar"
import { toast } from "sonner"
import api from "@/lib/api"
import { Step0_Customer } from "./checkout/Step0_Customer"
import { Check, ChevronRight, ChevronLeft, Loader2, ShoppingCart, AlertCircle, AlertTriangle, AlertCircle as AlertCircleIcon, ShieldAlert } from "lucide-react"
import { useGlobalModals } from "@/components/providers/GlobalModalProvider"
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

// ... other imports

interface SalesCheckoutWizardProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: any | null
    orderLines: any[]
    total: number
    totalDiscountAmount?: number
    onComplete: () => void
    customerName?: string  // Optional for backward compatibility
    initialCustomerName?: string
    initialCustomerId?: string
    channel?: string
    posSessionId?: number | null // POS session ID for cash control
    terminalId?: number // Terminal ID for filtering accounts
    quickSale?: boolean // Quick sale mode: auto-fill and jump to payment
    initialStep?: number
    initialDteData?: any
    initialPaymentData?: any
    initialDeliveryData?: any
    initialApprovalTaskId?: number | null
    initialIsWaitingApproval?: boolean
    initialIsApproved?: boolean
    initialDraftId?: number | null
    onStateChange?: (state: any) => void
}

export function SalesCheckoutWizard({
    open,
    onOpenChange,
    order,
    orderLines: initialOrderLines,
    total: initialTotal,
    totalDiscountAmount = 0,
    onComplete,
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
    onStateChange
}: SalesCheckoutWizardProps) {
    const [step, setStep] = useState(initialStep || 1)
    const [loading, setLoading] = useState(false)
    const [currentOrderLines, setCurrentOrderLines] = useState(initialOrderLines)
    const { dateString, serverDate } = useServerDate()

    // Use a ref to track whether we've already hydrated for the current open session
    const didHydrateRef = useRef(false)

    // Sync order lines and hydrate step data only when modal transitions from closed -> open
    useEffect(() => {
        if (open && !didHydrateRef.current) {
            didHydrateRef.current = true
            setCurrentOrderLines(initialOrderLines)
            
            // QUICK SALE OVERRIDES
            if (quickSale) {
                // Determine last step (Payment) based on items
                const currentIsOnlyService = initialOrderLines.every((line: any) => line.product_type === 'SERVICE');
                const currentHasManufacturing = initialOrderLines.some((line: any) =>
                    line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing
                );
                const lastStep = (currentIsOnlyService ? 3 : 4) + (currentHasManufacturing ? 1 : 0);
                
                // Force jump to last step unless we have a specific advanced step from a draft
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

                // For quick sale, if no customer is in prop, we'll wait for the default customer effect
                // but if it IS in prop (FORCED from POSPage), we set it now
                if (initialCustomerId) {
                    setSelectedCustomerId(initialCustomerId)
                }
            } else {
                // NORMAL HYDRATION (Draft restore OR defaults for fresh sale)
                // Using ?? so that null explicitly resets to defaults (prevents stale state leaking)
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
            
            // Payment Data is always hydrated from props or default
            setPaymentData(initialPaymentData ?? {
                method: 'CASH',
                amount: 0,
                transactionNumber: '',
                treasuryAccountId: null,
                isPending: false
            })

            // Restore customer from prop (important when re-loading same draft)
            setSelectedCustomerId(initialCustomerId ?? null)
            setSelectedCustomerName(initialCustomerName ?? null)
            setSelectedCustomer(null) // force re-fetch of full customer details
        }
        if (!open) {
            // Reset flag so next open triggers hydration again
            didHydrateRef.current = false
        }
    }, [open, initialStep, quickSale]) // eslint-disable-line react-hooks/exhaustive-deps
    // Run on open/close transition, and re-run if initialStep is injected slightly later (e.g. via React batching in page.tsx)

    // Resume polling if opened with an active task (and not already approved)
    useEffect(() => {
        if (open && initialApprovalTaskId) {
            if (initialIsApproved) {
                setIsApproved(true)
                setCreditApprovalRequired(true)
                setApprovalTaskId(initialApprovalTaskId)
            } else if (initialIsWaitingApproval) {
                setIsWaitingApproval(true)
                setCreditApprovalRequired(true)
                setApprovalTaskId(initialApprovalTaskId)
                pollApprovalStatus(initialApprovalTaskId)
            }
        }
    }, [open])

    const [dteData, setDteData] = useState(initialDteData || {
        type: 'BOLETA',
        number: '',
        date: '',
        attachment: null,
        isPending: false
    })

    // Sync DTE date with server date
    useEffect(() => {
        if (dateString && !initialDteData) {
            setDteData((prev: any) => ({ ...prev, date: dateString }))
        }
    }, [dateString, initialDteData])

    // Recalculate total if currentOrderLines changes (Gross total including 19% tax)
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

    // Approval Workflow State
    const [isWaitingApproval, setIsWaitingApproval] = useState(initialIsWaitingApproval || false)
    const [approvalTaskId, setApprovalTaskId] = useState<number | null>(initialApprovalTaskId || null)
    const [creditApprovalRequired, setCreditApprovalRequired] = useState(!!initialIsWaitingApproval || !!initialIsApproved)
    const [approvedTaskData, setApprovedTaskData] = useState<any | null>(null)
    const [securityErrorMessage, setSecurityErrorMessage] = useState<string | null>(null)
    const [hasHydrated, setHasHydrated] = useState(false)
    const [isApproved, setIsApproved] = useState(initialIsApproved || false)
    const [creditApprovalReason, setCreditApprovalReason] = useState<string | null>(null)
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // Sync payment amount when total changes
    // Sync payment amount when total changes - REMOVED to defaulting to 0
    // useEffect(() => {
    //    setPaymentData(prev => ({ ...prev, amount: currentTotal }));
    // }, [currentTotal]);

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
    const [selectedDocForHub, setSelectedDocForHub] = useState<number | null>(null)
    const [loadingDebts, setLoadingDebts] = useState(false)

    // Fetch pending debts if customer has active debt
    useEffect(() => {
        if (open && selectedCustomer && (Number(selectedCustomer.credit_balance_used || 0) > 0)) {
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
    }, [open, selectedCustomer])

    // Fetch sales settings for credit fallback
    useEffect(() => {
        if (open) {
            api.get('/accounting/settings/current/')
                .then(res => setSalesSettings(res.data))
                .catch(err => console.error("Error fetching sales settings:", err))
        }
    }, [open])

    // Auto-suggest delivery date if fabricable (includes any mfg or BOM)
    useEffect(() => {
        const fabricableLines = currentOrderLines.filter((line: any) =>
            ((line.product_type === 'MANUFACTURABLE' || line.has_bom) && !line.mfg_auto_finalize)
        );

        // Only auto-suggest if deliveryData hasn't been explicitly changed by the user
        // We assume it's untouched if it's IMMEDIATE and date is null
        if (fabricableLines.length > 0 && deliveryData.type === 'IMMEDIATE' && !deliveryData.date) {
            setDeliveryData((prev: any) => ({ ...prev, type: 'SCHEDULED' }));

            // Get the maximum default delivery days from the products
            const maxDays = fabricableLines.reduce((max: number, line: any) => {
                const days = line.mfg_default_delivery_days || 5;
                return Math.max(max, days);
            }, 0);

            // Suggest +maxDays
            if (serverDate) {
                const suggestedDate = new Date(serverDate);
                suggestedDate.setDate(suggestedDate.getDate() + maxDays);
                setDeliveryData((prev: any) => ({ ...prev, date: suggestedDate.toISOString().split('T')[0] }));
            }
        }
    }, [currentOrderLines, serverDate, deliveryData.type, deliveryData.date]);

    // Fetch default customer if none provided, or if Quick Sale forces it
    useEffect(() => {
        if ((!initialCustomerId || quickSale) && open && !selectedCustomerId) {
            const fetchDefaultCustomer = async () => {
                try {
                    const response = await api.get('/contacts/?is_default_customer=true');
                    const results = response.data.results || response.data;
                    const defaultCustomer = results.find((c: any) => c.is_default_customer);
                    if (defaultCustomer) {
                        setSelectedCustomerId(defaultCustomer.id.toString());
                        setSelectedCustomerName(defaultCustomer.name);
                        // The next useEffect will fetch the full details by ID
                    }
                } catch (error) {
                    console.error("Error fetching default customer:", error);
                }
            };
            fetchDefaultCustomer();
        }
    }, [initialCustomerId, open, quickSale, selectedCustomerId]);

    // Fetch task data if already approved (Resuming draft)
    useEffect(() => {
        if (open && isApproved && approvalTaskId && !approvedTaskData) {
            api.get(`/workflow/tasks/${approvalTaskId}/`)
                .then(res => setApprovedTaskData(res.data.data))
                .catch(err => console.error("Error fetching approved task data:", err))
        }
    }, [open, isApproved, approvalTaskId, approvedTaskData])

    // Fetch full customer details when ID changes
    useEffect(() => {
        if (selectedCustomerId && open) {
            api.get(`/contacts/${selectedCustomerId}/`)
                .then(res => {
                    setSelectedCustomer(res.data)
                    setSelectedCustomerName(res.data.name)
                })
                .catch(err => console.error("Error fetching full customer details:", err))
        } else {
            setSelectedCustomer(null)
        }
    }, [selectedCustomerId, open])

    // Sync internal customer state with prop changes (e.g. from draft load in parent)
    useEffect(() => {
        if (open && initialCustomerId && initialCustomerId !== selectedCustomerId) {
            setSelectedCustomerId(initialCustomerId)
        }
    }, [open, initialCustomerId])

    // Notify parent of state changes
    useEffect(() => {
        if (onStateChange) {
            onStateChange({
                step,
                dteData,
                paymentData,
                deliveryData,
                approvalTaskId,
                isWaitingApproval,
                isApproved,
                isLoading: loading,
                selectedCustomerId // Notify parent of customer changes inside wizard
            })
        }
    }, [step, dteData, paymentData, deliveryData, approvalTaskId, isWaitingApproval, isApproved, loading, onStateChange, selectedCustomerId])

    // Calculate step information
    // Calculate step information
    const isOnlyService = currentOrderLines.every((line: any) => line.product_type === 'SERVICE');
    const totalSteps = useMemo(() => (isOnlyService ? 3 : 4) + (hasManufacturing ? 1 : 0), [isOnlyService, hasManufacturing]);

    // Treasury accounts and methods for validation
    const { accounts } = useTreasuryAccounts({
        context: terminalId ? 'POS' : 'GENERAL',
        terminalId
    })

    const { methods: allowedMethods, loading: loadingMethods } = useAllowedPaymentMethods({
        terminalId,
        operation: 'sales',
        enabled: open
    })


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
            return (
                <Step1_DTE
                    dteData={dteData}
                    setDteData={setDteData}
                    isDefaultCustomer={!!selectedCustomer?.is_default_customer}
                />
            )
        }
        currentStepNum++;

        // Step: Delivery
        if (!isOnlyService && step === currentStepNum) {
            return <Step3_Delivery deliveryData={deliveryData} setDeliveryData={setDeliveryData} orderLines={currentOrderLines} />
        }
        if (!isOnlyService) currentStepNum++;

        // Step: Payment (LAST STEP)
        if (step === currentStepNum) {
            return <Step2_Payment paymentData={paymentData} setPaymentData={setPaymentData} total={currentTotal} terminalId={terminalId} />
        }

        return null;
    }

    const validateCurrentStep = async (): Promise<{ isValid: boolean, requireApproval?: boolean }> => {
        // Reset approval state
        setCreditApprovalRequired(false)

        // Find which logical step we are in
        let currentStepNum = 1;

        // Customer validation
        if (step === currentStepNum) {
            if (!selectedCustomerId) {
                toast.error("Debe seleccionar un cliente para continuar.")
                return { isValid: false }
            }

            // [NEW] Validation: Advanced manufacturing requires a real customer (not default)
            // hasManufacturing covers (requires_advanced_manufacturing OR !has_bom)
            if (hasManufacturing && selectedCustomer?.is_default_customer) {
                toast.error("No se puede utilizar el cliente por defecto para productos con fabricación avanzada.", {
                    description: "Por favor seleccione o cree un cliente específico para esta orden."
                })
                return { isValid: false }
            }

            return { isValid: true }
        }
        currentStepNum++;

        // Manufacturing validation
        if (hasManufacturing) {
            if (step === currentStepNum) {
                // Check if all mfg items have data
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


        // DTE validation
        if (step === currentStepNum) {
            if (dteData.type !== 'BOLETA' && !dteData.isPending) {
                if (!dteData.number) {
                    toast.error("Debe ingresar el número de folio para este tipo de documento.")
                    return { isValid: false }
                }
                if (!dteData.date) {
                    toast.error("Debe ingresar la fecha de emisión para este tipo de documento.")
                    return { isValid: false }
                }
                if (!dteData.attachment) {
                    toast.error("El archivo adjunto es obligatorio para este tipo de documento.")
                    return { isValid: false }
                }
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
                        return { isValid: false }
                    }
                } catch (error) {
                    console.error('Error validating folio:', error)
                    toast.error("Error al validar el folio. Por favor, intente nuevamente.")
                    return { isValid: false }
                }
            }

            return { isValid: true }
        }
        currentStepNum++;

        // Delivery validation (now before payment)
        if (!isOnlyService && step === currentStepNum) {
            // Delivery step has no specific validation currently
            return { isValid: true }
        }
        if (!isOnlyService) currentStepNum++;

        // Payment validation (LAST STEP)
        if (step === currentStepNum) {
            // Check if payment method is selected
            if (!paymentData.method) {
                toast.error("Debe seleccionar un método de pago para continuar.")
                return { isValid: false }
            }

            const isMethodAllowed = (methodId: string) => {
                if (loadingMethods) return true
                if (!allowedMethods.length) return false

                if (methodId === 'CASH') return allowedMethods.some(m => m.method_type === 'CASH')
                if (methodId === 'CARD') return allowedMethods.some(m => ['CREDIT_CARD', 'DEBIT_CARD', 'CARD_TERMINAL'].includes(m.method_type))
                if (methodId === 'TRANSFER') return allowedMethods.some(m => m.method_type === 'TRANSFER')
                if (methodId === 'CHECK') return allowedMethods.some(m => m.method_type === 'CHECK')
                return false
            }

            if (paymentData.method !== 'CREDIT' && paymentData.amount > 0) {
                if (!isMethodAllowed(paymentData.method)) {
                    toast.error(`El método ${paymentData.method} no está permitido o no tiene configuración válida.`)
                    return { isValid: false }
                }

                // Requirement: Always need a treasury account if amount > 0 and method is not CREDIT
                if (!paymentData.treasuryAccountId) {
                    toast.error("Debe seleccionar una cuenta de destino.")
                    return { isValid: false }
                }

                if (paymentData.method === 'TRANSFER' && !paymentData.isPending && !paymentData.transactionNumber) {
                    toast.error("Debe ingresar el número de transferencia o marcar como pendiente.")
                    return { isValid: false }
                }
            }

            // Credit Validation - check if bypass is active
            if (!approvalTaskId) {
                const amountPaid = paymentData.amount || 0;
                if (amountPaid < currentTotal) {
                    const requiredCredit = currentTotal - amountPaid;

                    if (!selectedCustomer) {
                        toast.error("Debe seleccionar un cliente para asignar crédito.");
                        return { isValid: false };
                    }

                    if (selectedCustomer.credit_blocked || (selectedCustomer.credit_auto_blocked && !selectedCustomer.is_default_customer)) {
                        const reason = selectedCustomer.credit_auto_blocked ? "mora excesiva" : "restricción contractual";
                        toast.error("El crédito está bloqueado para este cliente.", {
                            description: `Motivo: ${reason}. Se requiere pago inmediato de la totalidad.`
                        });
                        return { isValid: false };
                    }

                    // 2. Check secured credit limit
                    // Credit is now implicit. If a limit is assigned, use it.
                    const creditAvailable = Number(selectedCustomer.credit_available || 0);

                    if (requiredCredit > creditAvailable) {
                        // 3. Fallback logic: Only if NO outstanding debt exists
                        const hasDebt = Number(selectedCustomer.credit_balance_used || 0) > 0;
                        const fallbackPercentage = (Number(salesSettings?.pos_default_credit_percentage) || 0) / 100;
                        const allowedFallback = currentTotal * fallbackPercentage;

                        if ((!hasDebt || selectedCustomer.is_default_customer) && requiredCredit <= allowedFallback) {
                            // Fallback applies!
                            return { isValid: true };
                        }

                        // Set descriptive states for the banner
                        setCreditApprovalReason(
                            (hasDebt && !selectedCustomer.is_default_customer) ? "Deuda activa bloquea el crédito pre-aprobado (fallback)." :
                            requiredCredit > allowedFallback ? `Excede el límite pre-aprobado ($${allowedFallback.toLocaleString()}).` :
                            `Crédito insuficiente (Disponible: $${creditAvailable.toLocaleString()}).`
                        );
                        setCreditApprovalRequired(true);
                        return { isValid: false, requireApproval: true };
                    }
                }
            }

            return { isValid: true }
        }


        return { isValid: true }
    }

    const handleNext = async () => {
        const validation = await validateCurrentStep()
        if (!validation.isValid) return
        setStep(prev => prev + 1)
    }

    const handleBack = () => setStep(prev => prev - 1)

    // Helper to generate the API formData payload
    const buildCheckoutFormData = () => {
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

        if (initialDraftId) {
            formData.append('draft_id', initialDraftId.toString())
        }

        return formData
    }

    const executeCheckout = async () => {
        setLoading(true)
        try {
            const formData = buildCheckoutFormData()
            await api.post('/billing/invoices/pos_checkout/', formData)
            toast.success("Venta procesada correctamente")
            onComplete()
            onOpenChange(false)
        } catch (error: any) {
            console.error("Checkout error:", error)
            const rawError = error.response?.data?.error || "Error al procesar la venta"
            const errorMessage = Array.isArray(rawError) ? rawError[0] : String(rawError)
            
            // Check for specific security errors (Anti-fraud)
            if (errorMessage.includes("Intento de aumento de crédito") || 
                errorMessage.includes("Aprobación de crédito fue emitida para otro cliente") ||
                errorMessage.includes("Seguridad:")) {
                setSecurityErrorMessage(errorMessage)
            } else {
                toast.error(errorMessage)
            }

            // Reset loading state on error
            setLoading(false)

            // If the bypass failed (e.g. task rejected), reset it
            if (approvalTaskId && !errorMessage.includes("Intento de aumento") && !errorMessage.includes("Seguridad:")) {
                setApprovalTaskId(null)
                setIsWaitingApproval(false)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleFinish = async () => {
        // Final validation
        const validation = await validateCurrentStep()
        if (validation.requireApproval) {
            // Keep the UI exactly where it is, but show the approval banner
            return
        }
        if (!validation.isValid) return

        executeCheckout()
    }

    // Approval Workflow Handlers
    const handleRequestApproval = async () => {
        setIsWaitingApproval(true)
        try {
            const formData = buildCheckoutFormData()
            const response = await api.post('/billing/invoices/request_credit/', formData)
            const taskId = response.data.task_id
            setApprovalTaskId(taskId)

            // Start polling
            pollApprovalStatus(taskId)
        } catch (error: any) {
            console.error("Error requesting approval:", error)
            toast.error(error.response?.data?.error || "Error al solicitar aprobación")
            setIsWaitingApproval(false)
        }
    }

    const cancelApprovalRequest = () => {
        if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        setIsWaitingApproval(false)
        setApprovalTaskId(null)
        setCreditApprovalRequired(false)
        toast.info("Solicitud de aprobación cancelada.")
        // Optionally notify backend to cancel task
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
                // If PENDING or IN_PROGRESS, continue polling
            } catch (error) {
                console.error("Error polling task:", error)
                // don't stop polling on intermittent network error, but maybe add retry limit
            }
        }, 3000)
    }

    // Cleanup interval on unmount
    useEffect(() => {
        return () => {
            if (pollingIntervalRef.current) clearInterval(pollingIntervalRef.current)
        }
    }, [])

    return (
        <>
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
                        {initialDraftId && (
                            <span className="text-[10px] font-mono text-muted-foreground font-normal tracking-wider">
                                Borrador <span className="text-primary/80 font-bold">#{initialDraftId}</span>
                            </span>
                        )}
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
                            className="w-48 h-12 bg-success hover:bg-success/90 text-success-foreground font-bold"
                            disabled={loading || isWaitingApproval}
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
                    paymentData={step > (hasManufacturing ? 4 : 3) ? {
                        method: paymentData.method,
                        amount: paymentData.amount,
                        creditAssigned: paymentData.amount < currentTotal ? currentTotal - paymentData.amount : 0
                    } : undefined}
                    deliveryData={step > (hasManufacturing ? 3 : 2) ? deliveryData : undefined}
                />

                {/* Center - Content Area Wrapper */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Scrollable Content */}
                    <div className="flex-1 p-6 overflow-y-auto">
                        {selectedCustomer && (selectedCustomer.credit_blocked || (selectedCustomer.credit_auto_blocked && !selectedCustomer.is_default_customer)) && (
                            <Alert variant="destructive" className="mb-4 bg-rose-50 border-rose-200 text-rose-900 group">
                                <ShieldAlert className="h-4 w-4 text-rose-600" />
                                <AlertTitle className="text-rose-800 font-bold uppercase tracking-tight flex items-center justify-between">
                                    Crédito Bloqueado
                                    {selectedCustomer.credit_auto_blocked && (
                                        <span className="text-[10px] bg-rose-100 px-2 py-0.5 rounded text-rose-600 font-black">
                                            TEMPORAL
                                        </span>
                                    )}
                                </AlertTitle>
                                <AlertDescription className="text-rose-700 mt-1">
                                    <div className="flex flex-col gap-2">
                                        <p>
                                            Este cliente tiene el crédito restringido por <strong>{selectedCustomer.credit_auto_blocked ? 'mora excesiva' : 'política contractual'}</strong>. 
                                            Se requiere el pago total de la venta para procesar.
                                        </p>
                                        {(selectedCustomer.credit_balance_used > 0) && (
                                            <div className="flex items-center justify-between bg-white/50 p-2 rounded-lg border border-rose-100 mt-1">
                                                <div>
                                                    <span className="block text-[10px] font-bold text-rose-500 uppercase">Deuda Pendiente</span>
                                                    <span className="font-mono font-bold text-rose-800">${Number(selectedCustomer.credit_balance_used).toLocaleString()}</span>
                                                </div>
                                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                                    {loadingDebts ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-rose-500" />
                                                    ) : pendingDebts && pendingDebts.length > 0 ? (
                                                        pendingDebts.slice(0, 3).map((debt: any) => (
                                                            <Button 
                                                                key={debt.id}
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-7 text-xs border-rose-200 text-rose-700 hover:bg-rose-100 font-bold"
                                                                onClick={() => setSelectedDocForHub(debt.id)}
                                                            >
                                                                Pagar NV-{debt.number}
                                                            </Button>
                                                        ))
                                                    ) : null}
                                                    {pendingDebts && pendingDebts.length > 3 && (
                                                        <span className="text-xs text-rose-600 font-bold">+{pendingDebts.length - 3}</span>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {selectedCustomer && !selectedCustomer.is_default_customer && !selectedCustomer.credit_blocked && !selectedCustomer.credit_auto_blocked && Number(selectedCustomer.credit_balance_used || 0) > 0 && (
                            <Alert variant="destructive" className="mb-4 bg-amber-50 border-amber-200 text-amber-900">
                                <AlertTriangle className="h-4 w-4 text-amber-600" />
                                <AlertTitle className="text-amber-800 font-bold uppercase tracking-tight">Deuda Activa Detectada</AlertTitle>
                                <AlertDescription className="text-amber-700 mt-1">
                                    <div className="flex flex-col gap-2">
                                        <p>
                                            El cliente tiene un saldo pendiente de <strong>${Number(selectedCustomer.credit_balance_used).toLocaleString()}</strong>. El crédito pre-aprobado (fallback) no estará disponible.
                                        </p>
                                        <div className="flex justify-end mt-1 gap-2 flex-wrap">
                                            {loadingDebts ? (
                                                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                                            ) : pendingDebts && pendingDebts.length > 0 ? (
                                                pendingDebts.slice(0, 3).map((debt: any) => (
                                                    <Button 
                                                        key={debt.id}
                                                        size="sm" 
                                                        className="h-7 text-xs bg-amber-600 hover:bg-amber-700 text-white font-bold"
                                                        onClick={() => setSelectedDocForHub(debt.id)}
                                                    >
                                                        Pagar NV-{debt.number}
                                                    </Button>
                                                ))
                                            ) : null}
                                            {pendingDebts && pendingDebts.length > 3 && (
                                                <span className="text-xs text-amber-700 font-bold self-center">+{pendingDebts.length - 3}</span>
                                            )}
                                        </div>
                                    </div>
                                </AlertDescription>
                            </Alert>
                        )}

                        {creditApprovalRequired && !isWaitingApproval && !isApproved && (
                            <div className="mb-4 p-3 border border-warning/50 bg-warning/5 rounded-xl flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-warning/20 rounded-full text-warning shrink-0">
                                        <AlertCircle className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold text-warning uppercase tracking-tight">Autorización Requerida</h3>
                                        <p className="text-xs text-muted-foreground">
                                            {creditApprovalReason || "El monto excede el crédito disponible o permitido."}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button size="sm" variant="ghost" onClick={() => setCreditApprovalRequired(false)} className="h-8 text-xs">
                                        Ajustar
                                    </Button>
                                    <Button size="sm" onClick={handleRequestApproval} className="h-8 text-xs bg-warning hover:bg-warning/90 text-warning-foreground font-bold px-4">
                                        Solicitar Autorización
                                    </Button>
                                </div>
                            </div>
                        )}

                        {isWaitingApproval && (
                            <div className="mb-4 p-3 border rounded-xl flex items-center justify-between gap-4 bg-primary/5 animate-pulse border-primary/20">
                                <div className="flex items-center gap-3">
                                    <div className="relative shrink-0">
                                        <Loader2 className="w-5 h-5 text-primary animate-spin" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold">Esperando Autorización...</h3>
                                        <p className="text-xs text-muted-foreground">
                                            Solicitud enviada. Pendiente de aprobación en bandeja de entrada.
                                        </p>
                                    </div>
                                </div>
                                <Button size="sm" variant="ghost" onClick={cancelApprovalRequest} className="h-8 text-xs text-destructive hover:bg-destructive/10">
                                    Cancelar
                                </Button>
                            </div>
                        )}

                        {isApproved && (
                            <div className="mb-4 p-3 border border-success/50 bg-success/5 rounded-xl flex items-center justify-between gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-success/20 rounded-full text-success shrink-0">
                                        <Check className="w-5 h-5" />
                                    </div>
                                    <div className="text-left">
                                        <h3 className="text-sm font-bold text-success">Crédito Aprobado</h3>
                                        <p className="text-xs text-muted-foreground">
                                            La solicitud ha sido autorizada. Ya puede finalizar la venta.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className={(creditApprovalRequired || isWaitingApproval) && !isApproved ? "opacity-30 pointer-events-none transition-opacity" : ""}>
                            {renderStep()}
                        </div>
                    </div>
                </div>

                {/* Right Sidebar - Product Summary */}
                <div className="w-80 border-l hidden lg:block overflow-y-auto">
                    <OrderSummaryCard
                        orderLines={currentOrderLines}
                        total={currentTotal}
                        totalDiscountAmount={totalDiscountAmount}
                        dteType={dteData.type}
                        customer={selectedCustomer}
                    />
                </div>
            </div>
        </BaseModal>

        {/* Security Discrepancy Recovery Dialog */}
        <AlertDialog open={!!securityErrorMessage} onOpenChange={(open) => !open && setSecurityErrorMessage(null)}>
            <AlertDialogContent className="max-w-md border-destructive/20 shadow-2xl">
                <AlertDialogHeader>
                    <div className="mx-auto bg-destructive/10 p-3 rounded-full mb-4">
                        <ShieldAlert className="h-10 w-10 text-destructive" />
                    </div>
                    <AlertDialogTitle className="text-center text-xl font-black tracking-tight text-destructive uppercase">
                        Discrepancia de Seguridad
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-center text-slate-300 pt-2">
                        {securityErrorMessage}
                        <br /><br />
                        Los montos de la venta o el cliente no coinciden con la autorización previa. ¿Deseas restaurar los valores que fueron autorizados originalmente?
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="flex-col sm:flex-col gap-2 mt-4">
                    <AlertDialogAction 
                        className="bg-primary hover:bg-primary/90 font-bold h-12"
                        onClick={() => {
                            if (approvedTaskData) {
                                // Restore customer if mismatch
                                if (approvedTaskData.customer_id) {
                                    setSelectedCustomerId(approvedTaskData.customer_id.toString())
                                }
                                // Restore payment amount to match required credit
                                if (approvedTaskData.required_credit) {
                                    const approvedCreditUsage = parseFloat(approvedTaskData.required_credit)
                                    const restoredPayment = Math.max(0, currentTotal - approvedCreditUsage)
                                    setPaymentData({
                                        ...paymentData,
                                        amount: restoredPayment
                                    })
                                    toast.success("Valores restaurados a los niveles autorizados.")
                                }
                            }
                            setSecurityErrorMessage(null)
                        }}
                    >
                        Restaurar valores aprobados
                    </AlertDialogAction>
                    <AlertDialogCancel 
                        className="border-none hover:bg-white/5 text-xs text-muted-foreground"
                    >
                        Cancelar y corregir manualmente
                    </AlertDialogCancel>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <OrderCommandCenter
            open={!!selectedDocForHub}
            onOpenChange={(o) => !o && setSelectedDocForHub(null)}
            orderId={selectedDocForHub}
            type="sale"
            onActionSuccess={() => {
                // Refresh customer data to update debt
                if (selectedCustomerId) {
                    api.get(`/contacts/${selectedCustomerId}/`)
                        .then(res => {
                            setSelectedCustomer(res.data)
                        })
                        .catch(err => console.error("Error refreshing customer:", err))
                }
            }}
        />
        </>
    )
}

export default SalesCheckoutWizard
