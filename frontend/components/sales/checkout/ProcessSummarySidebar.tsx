"use client"

import { User, Tag, CreditCard, ShoppingBag, CheckCircle2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface ProcessSummarySidebarProps {
    currentStep: number
    totalSteps: number
    customerName?: string
    dteType?: string
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

const STEPS = [
    { id: 1, label: 'Cliente', icon: User },
    { id: 2, label: 'Documento', icon: Tag },
    { id: 3, label: 'Pago', icon: CreditCard },
    { id: 4, label: 'Entrega', icon: ShoppingBag }
]

export function ProcessSummarySidebar({
    currentStep,
    totalSteps,
    customerName,
    dteType,
    paymentData,
    deliveryData
}: ProcessSummarySidebarProps) {
    const visibleSteps = STEPS.slice(0, totalSteps)

    return (
        <div className="w-64 border-r bg-muted/10 p-4 space-y-2 hidden md:block overflow-y-auto">
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 px-2">
                Proceso de Venta
            </h3>

            {visibleSteps.map((step) => {
                const Icon = step.icon
                const isActive = currentStep === step.id
                const isPast = currentStep > step.id
                const isFuture = currentStep < step.id

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
                                {step.id === 1 && customerName && (
                                    <p className="text-xs font-semibold truncate">{customerName}</p>
                                )}
                                {step.id === 2 && dteType && (
                                    <p className="text-xs font-semibold">{dteType}</p>
                                )}
                                {step.id === 3 && paymentData && (
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
                                {step.id === 4 && deliveryData && (
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
