"use client"

import { FileText, Building2, CreditCard, Package, Warehouse, ShoppingCart } from "lucide-react"
import { DrawerResizableRail, MoneyDisplay, WizardStepsSidebar, type WizardSidebarStep } from "@/components/shared"
import { TooltipProvider } from "@/components/ui/tooltip"

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
    collapsed?: boolean
    onToggleCollapsed?: () => void
    onStepClick?: (stepIndex: number) => void
}

const methodLabels: Record<string, string> = {
    'CASH': 'Efectivo',
    'TRANSFER': 'Transferencia',
    'DEBIT': 'Débito',
    'CREDIT': 'Crédito',
    'CHECK': 'Cheque',
    'CARD': 'Tarjeta',
    'CARD_TERMINAL': 'Tarjeta (Terminal)',
    'CREDIT_CARD': 'T. Crédito',
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

export function PurchaseProcessSummarySidebar({
    currentStep,
    totalSteps,
    supplierName,
    warehouseName,
    dteType,
    paymentData,
    receiptData,
    collapsed,
    onToggleCollapsed,
    onStepClick,
}: PurchaseProcessSummarySidebarProps) {
    const isSubscriptionOnly = totalSteps === 4

    const allSteps: WizardSidebarStep[] = [
        {
            id: 1,
            label: 'Proveedor',
            icon: Building2,
            detail: supplierName ? <p className="text-3xs font-semibold truncate">{supplierName}</p> : undefined
        },
        {
            id: 2,
            label: 'Productos',
            icon: ShoppingCart,
        },
        {
            id: 3,
            label: 'Documento',
            icon: FileText,
            detail: dteType ? <p className="text-3xs font-semibold">{dteType}</p> : undefined
        },
        ...(isSubscriptionOnly ? [
            {
                id: 4,
                label: 'Pago',
                icon: CreditCard,
                detail: paymentData ? (
                    <div className="space-y-0.5">
                        <p className="text-3xs font-semibold">
                            {paymentData.method ? (methodLabels[paymentData.method] || paymentData.method) : 'Crédito'}
                        </p>
                        <MoneyDisplay amount={paymentData.amount} className="text-3xs font-bold" />
                        {paymentData.pendingDebt !== undefined && paymentData.pendingDebt > 0 && (
                            <div className="text-3xs text-warning font-semibold flex items-center gap-1">
                                Deuda: <MoneyDisplay amount={paymentData.pendingDebt} inline />
                            </div>
                        )}
                    </div>
                ) : undefined
            }
        ] : [
            {
                id: 4,
                label: 'Recepción',
                icon: Package,
                detail: receiptData ? (
                    <div className="space-y-1">
                        <p className="text-3xs font-semibold">{receiptLabels[receiptData.type]}</p>
                        {warehouseName && (
                            <div className="flex items-center gap-1.5 mt-1">
                                <Warehouse className="h-3 w-3" />
                                <p className="text-3xs font-semibold truncate">{warehouseName}</p>
                            </div>
                        )}
                    </div>
                ) : undefined
            },
            {
                id: 5,
                label: 'Pago',
                icon: CreditCard,
                detail: paymentData ? (
                    <div className="space-y-0.5">
                        <p className="text-3xs font-semibold">
                            {paymentData.method ? (methodLabels[paymentData.method] || paymentData.method) : 'Crédito'}
                        </p>
                        <MoneyDisplay amount={paymentData.amount} className="text-3xs font-bold" />
                        {paymentData.pendingDebt !== undefined && paymentData.pendingDebt > 0 && (
                            <div className="text-3xs text-warning font-semibold flex items-center gap-1">
                                Deuda: <MoneyDisplay amount={paymentData.pendingDebt} inline />
                            </div>
                        )}
                    </div>
                ) : undefined
            }
        ])
    ]

    const steps = allSteps.slice(0, totalSteps)

    return (
        <TooltipProvider delayDuration={300}>
            <DrawerResizableRail
                side="left"
                collapsed={collapsed}
                onToggleCollapsed={onToggleCollapsed}
                storageKey="erpgrafico.purchasing.railCollapsed"
                defaultWidth={256}
                minWidth={200}
                maxWidth={420}
                compactWidth={56}
                ariaLabel="Redimensionar proceso de compra"
                className="hidden md:flex"
            >
                <WizardStepsSidebar
                    title="Proceso de Compra"
                    currentStep={currentStep}
                    steps={steps}
                    width="w-full"
                    className="bg-transparent flex-1 min-h-0"
                    onStepClick={onStepClick}
                    showNumbers={true}
                    detailVisibility="both"
                    showCounter={false}
                    showConnector={false}
                    listClassName="px-2 pt-1 space-y-1.5"
                    collapsed={collapsed}
                />
            </DrawerResizableRail>
        </TooltipProvider>
    )
}