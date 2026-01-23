"use client"

import { FileText, Package, Tag, CheckCircle2, AlertCircle, CreditCard } from "lucide-react"
import { cn } from "@/lib/utils"

interface NoteProcessSidebarProps {
    currentStep: number
    totalSteps: number
    noteType: 'NOTA_CREDITO' | 'NOTA_DEBITO'
    requiresLogistics: boolean
    itemsCount: number
    dteNumber?: string
}

export function NoteProcessSidebar({
    currentStep,
    totalSteps,
    noteType,
    requiresLogistics,
    itemsCount,
    dteNumber
}: NoteProcessSidebarProps) {
    const steps = [
        { id: 'items', label: 'Productos', icon: Package },
    ]

    if (requiresLogistics) {
        steps.push({ id: 'logistics', label: 'Logística', icon: Tag })
    }

    steps.push(
        { id: 'dte', label: 'Documento', icon: FileText },
        { id: 'payment', label: 'Pago', icon: CreditCard }
    )

    return (
        <div className="w-64 border-r bg-muted/10 p-4 space-y-2 hidden md:block overflow-y-auto">
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 px-2">
                {noteType === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'}
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
                                {step.id === 'items' && itemsCount > 0 && (
                                    <p className="text-xs font-semibold">{itemsCount} productos seleccionados</p>
                                )}
                                {step.id === 'logistics' && (
                                    <p className="text-xs font-semibold">Movimiento registrado</p>
                                )}
                                {step.id === 'dte' && dteNumber && (
                                    <p className="text-xs font-semibold">Folio: {dteNumber}</p>
                                )}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
