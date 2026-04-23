"use client"

import { FileText, User, CreditCard, ShoppingBag, CheckCircle2, Paintbrush } from "lucide-react"
import { cn, formatPlainDate } from "@/lib/utils"
import { MoneyDisplay } from "@/components/shared"

interface ProcessSummarySidebarProps {
    currentStep: number
    totalSteps: number
    customerName?: string
    dteType?: string
    hasManufacturing?: boolean
    paymentData?: {
        method: string
        amount: number
        creditAssigned?: number
    }
    deliveryData?: {
        type: string
        date?: string
    }
}

const methodLabels: Record<string, string> = {
    'CASH': 'Efectivo',
    'CARD': 'Tarjeta',
    'TRANSFER': 'Transferencia',
    'CREDIT': 'Crédito'
}

const deliveryLabels: Record<string, string> = {
    'IMMEDIATE': 'Entrega Inmediata',
    'SCHEDULED': 'Entrega Programada',
    'PICKUP': 'Retiro en Tienda',
    'PARTIAL': 'Entrega Parcial'
}

export function ProcessSummarySidebar({
    currentStep,
    totalSteps,
    customerName,
    dteType,
    hasManufacturing,
    paymentData,
    deliveryData
}: ProcessSummarySidebarProps) {
    // Dynamically build the steps list
    const steps = [
        { id: 'customer_dte', label: 'Cliente & Doc', icon: User },
    ]

    if (hasManufacturing) {
        steps.push({ id: 'mfg', label: 'Fabricación', icon: Paintbrush })
    }

    if (totalSteps > (hasManufacturing ? 3 : 2)) {
        steps.push({ id: 'delivery', label: 'Entrega', icon: ShoppingBag })
    }

    steps.push({ id: 'payment', label: 'Pago', icon: CreditCard })

    return (
        <div className="w-64 border-r bg-muted/10 p-4 space-y-2 hidden md:block overflow-y-auto">
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 px-2">
                Proceso de Venta
            </h3>

            {steps.map((step, index) => {
                const stepNumber = index + 1
                const Icon = step.icon
                const isActive = currentStep === stepNumber
                const isPast = currentStep > stepNumber
                const isFuture = currentStep < stepNumber

                return (
                    <div
                        key={step.id}
                        className={cn(
                            "rounded-lg transition-all duration-200",
                            isActive && "bg-primary text-primary-foreground shadow-sm",
                            isPast && "bg-success/10 text-success",
                            isFuture && "text-muted-foreground"
                        )}
                    >
                        <div className="flex items-center space-x-3 p-3">
                            <Icon className="h-5 w-5 shrink-0" />
                            <span className="text-sm font-medium flex-1">{step.label}</span>
                            {isPast && <CheckCircle2 className="h-4 w-4" />}
                        </div>

                        {/* Step Details */}
                        {isPast && (
                            <div className="px-3 pb-3 pt-1 space-y-1 animate-in fade-in duration-300">
                                {step.id === 'customer_dte' && (
                                    <>
                                        {customerName && <p className="text-xs font-semibold truncate">{customerName}</p>}
                                        {dteType && <p className="text-xs font-semibold mt-1">{dteType}</p>}
                                    </>
                                )}
                                {step.id === 'payment' && paymentData && (
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-semibold">
                                            {methodLabels[paymentData.method]}
                                        </p>
                                        <MoneyDisplay amount={paymentData.amount} className="text-xs font-bold" />
                                        {paymentData.creditAssigned !== undefined && paymentData.creditAssigned > 0 && (
                                            <div className="text-[10px] text-warning font-semibold flex items-center gap-1">
                                                Crédito: <MoneyDisplay amount={paymentData.creditAssigned} inline />
                                            </div>
                                        )}
                                    </div>
                                )}
                                {step.id === 'delivery' && deliveryData && (
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-semibold">
                                            {deliveryLabels[deliveryData.type]}
                                        </p>
                                        {deliveryData.date && (
                                            <p className="text-[10px]">
                                                {formatPlainDate(deliveryData.date)}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
