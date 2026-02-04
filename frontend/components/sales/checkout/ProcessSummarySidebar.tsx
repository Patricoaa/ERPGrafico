"use client"

import { FileText, User, CreditCard, ShoppingBag, CheckCircle2, Paintbrush } from "lucide-react"
import { cn } from "@/lib/utils"

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
        { id: 'customer', label: 'Cliente', icon: User },
    ]

    if (hasManufacturing) {
        steps.push({ id: 'mfg', label: 'Fabricación', icon: Paintbrush })
    }

    steps.push({ id: 'dte', label: 'Documento', icon: FileText })

    if (totalSteps > (hasManufacturing ? 4 : 3)) {
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
                            isPast && "bg-green-50 text-green-700",
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
                                {step.id === 'customer' && customerName && (
                                    <p className="text-xs font-semibold truncate">{customerName}</p>
                                )}
                                {step.id === 'dte' && dteType && (
                                    <p className="text-xs font-semibold">{dteType}</p>
                                )}
                                {step.id === 'payment' && paymentData && (
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-semibold">
                                            {methodLabels[paymentData.method]}
                                        </p>
                                        <p className="text-xs font-bold">
                                            ${paymentData.amount.toLocaleString()}
                                        </p>
                                        {paymentData.creditAssigned !== undefined && paymentData.creditAssigned > 0 && (
                                            <p className="text-[10px] text-orange-600 font-semibold">
                                                Crédito: ${paymentData.creditAssigned.toLocaleString()}
                                            </p>
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
                                                {new Date(deliveryData.date).toLocaleDateString('es-CL')}
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
