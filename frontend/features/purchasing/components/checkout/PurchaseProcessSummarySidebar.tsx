"use client"

import { FileText, Building2, Tag, CreditCard, Package, Warehouse, CheckCircle2, ShoppingCart } from "lucide-react"

import { cn } from "@/lib/utils"
import { PaymentMethod, ReceptionType } from "@/types/checkout"

export interface PurchaseProcessSummarySidebarProps {
    currentStep: number
    totalSteps: number
    supplierName?: string
    warehouseName?: string
    dteType?: string
    paymentData?: {
        method: string | null
        amount: number
        pendingDebt?: number
    }
    receiptData?: {
        type: string
    }
}

const methodLabels: Record<string, string> = {
    'CASH': 'Efectivo',
    'TRANSFER': 'Transferencia',
    'DEBIT': 'Débito',
    'CREDIT': 'Crédito',
    'CHECK': 'Cheque',
    'CARD': 'Tarjeta',
    'CARD_TERMINAL': 'Tarjeta (Terminal)',
    'CREDIT_BALANCE': 'Saldo a Favor'
}

const receiptLabels: Record<string, string> = {
    'immediate': 'Recepción Inmediata (Bodega)',
    'IMMEDIATE': 'Recepción Inmediata (Bodega)',
    'dispatch': 'Despacho a Domicilio',
    'DEFERRED': 'Recepción Diferida',
    'provisional': 'Recepción Provisoria',
    'PARTIAL': 'Recepción Parcial'
}

const STEPS = [
    { id: 1, label: 'Proveedor', icon: Building2 },
    { id: 2, label: 'Productos', icon: ShoppingCart },
    { id: 3, label: 'Documento', icon: FileText },
    { id: 4, label: 'Pago', icon: CreditCard },
    { id: 5, label: 'Recepción', icon: Package, subLabel: 'Bodega', subIcon: Warehouse }
]

export function PurchaseProcessSummarySidebar({
    currentStep,
    totalSteps,
    supplierName,
    warehouseName,
    dteType,
    paymentData,
    receiptData
}: PurchaseProcessSummarySidebarProps) {
    const visibleSteps = STEPS.slice(0, totalSteps)

    return (
        <div className="w-64 border-r bg-muted/10 p-4 space-y-2 hidden md:block overflow-y-auto">
            <h3 className="text-xs font-bold uppercase text-muted-foreground mb-4 px-2">
                Proceso de Compra
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
                                {step.id === 1 && supplierName && (
                                    <p className="text-xs font-semibold truncate">{supplierName}</p>
                                )}
                                {step.id === 3 && dteType && (
                                    <p className="text-xs font-semibold">{dteType}</p>
                                )}
                                {step.id === 4 && paymentData && (
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-semibold">
                                            {paymentData.method ? (methodLabels[paymentData.method] || paymentData.method) : 'Crédito'}
                                        </p>
                                        <p className="text-xs font-bold">
                                            ${paymentData.amount.toLocaleString()}
                                        </p>
                                        {paymentData.pendingDebt !== undefined && paymentData.pendingDebt > 0 && (
                                            <p className="text-[10px] text-warning font-semibold">
                                                Deuda: ${paymentData.pendingDebt.toLocaleString()}
                                            </p>
                                        )}
                                    </div>
                                )}
                                {step.id === 5 && receiptData && (
                                    <div className="space-y-1">
                                        <p className="text-xs font-semibold">
                                            {receiptLabels[receiptData.type]}
                                        </p>
                                        {warehouseName && (
                                            <div className="flex items-center gap-1.5 mt-1">
                                                <Warehouse className="h-3 w-3" />
                                                <p className="text-[10px] font-semibold truncate">{warehouseName}</p>
                                            </div>
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
