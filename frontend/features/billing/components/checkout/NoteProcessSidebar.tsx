"use client"

import { FileText, Package, CheckCircle2, CreditCard, ShoppingBag, Truck } from "lucide-react"
import { cn } from "@/lib/utils"

interface NoteProcessSidebarProps {
    currentStep: number
    totalSteps: number
    noteType: 'NOTA_CREDITO' | 'NOTA_DEBITO'
    requiresLogistics: boolean
    hasManufacturing: boolean
    itemsCount: number
    dteNumber?: string
    paymentData?: {
        method: string
        amount: number
    }
}

const methodLabels: Record<string, string> = {
    'CASH': 'Efectivo',
    'CARD': 'Tarjeta',
    'TRANSFER': 'Transferencia',
    'CREDIT': 'Crédito'
}

export function NoteProcessSidebar({
    currentStep,
    totalSteps,
    noteType,
    requiresLogistics,
    hasManufacturing,
    itemsCount,
    dteNumber,
    paymentData
}: NoteProcessSidebarProps) {
    const steps = [
        { id: 'items', label: 'Productos', icon: Package },
    ]

    if (hasManufacturing) {
        steps.push({ id: 'manufacturing', label: 'Producción', icon: ShoppingBag })
    }

    if (requiresLogistics) {
        steps.push({ id: 'logistics', label: 'Logística', icon: Truck })
    }

    steps.push(
        { id: 'dte', label: 'Documento', icon: FileText },
        { id: 'payment', label: 'Pago', icon: CreditCard }
    )

    return (
        <div className="w-64 border-r bg-muted/10 p-4 space-y-2 hidden md:block overflow-y-auto">
            <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 mb-4 px-2">
                {noteType === 'NOTA_CREDITO' ? 'Proceso Nota Crédito' : 'Proceso Nota Débito'}
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
                                {step.id === 'items' && itemsCount > 0 && (
                                    <p className="text-xs font-semibold">{itemsCount} productos seleccionados</p>
                                )}
                                {step.id === 'manufacturing' && (
                                    <p className="text-xs font-semibold">Producción configurada</p>
                                )}
                                {step.id === 'logistics' && (
                                    <p className="text-xs font-semibold">Movimiento registrado</p>
                                )}
                                {step.id === 'dte' && (
                                    <p className="text-xs font-semibold">
                                        {dteNumber ? `Folio: ${dteNumber}` : 'Documento registrado'}
                                    </p>
                                )}
                                {step.id === 'payment' && paymentData && paymentData.method && (
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-semibold">
                                            {methodLabels[paymentData.method]}
                                        </p>
                                        <p className="text-xs font-bold">
                                            ${paymentData.amount.toLocaleString()}
                                        </p>
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

