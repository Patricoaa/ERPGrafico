"use client"

import { User, Wallet, Truck, Hammer, FileText } from "lucide-react"
import { cn, formatPlainDate } from "@/lib/utils"
import { MoneyDisplay, WizardStepsSidebar, type WizardSidebarStep } from "@/components/shared"

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
    'CREDIT_CARD': 'T. Crédito',
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
    customerName,
    dteType,
    hasManufacturing,
    paymentData,
    deliveryData
}: ProcessSummarySidebarProps) {
    const steps: WizardSidebarStep[] = [
        {
            id: 'customer',
            label: 'Cliente',
            icon: User,
            detail: customerName ? <p className="text-xs font-semibold truncate">{customerName}</p> : undefined
        },
        {
            id: 'dte',
            label: 'Documento',
            icon: FileText,
            detail: dteType ? <p className="text-xs font-semibold">{dteType}</p> : undefined
        },
    ]

    if (hasManufacturing) {
        steps.push({
            id: 'manufacturing',
            label: 'Fabricación',
            icon: Hammer,
            detail: <p className="text-xs font-semibold">Fabricación configurada</p>
        })
    }

    steps.push({
        id: 'delivery',
        label: 'Entrega',
        icon: Truck,
        detail: deliveryData ? (
            <div className="space-y-0.5">
                <p className="text-xs font-semibold">{deliveryLabels[deliveryData.type]}</p>
                {deliveryData.date && (
                    <p className="text-[10px]">{formatPlainDate(deliveryData.date)}</p>
                )}
            </div>
        ) : undefined
    })

    steps.push({
        id: 'payment',
        label: 'Pago',
        icon: Wallet,
        detail: paymentData ? (
            <div className="space-y-0.5">
                <p className="text-xs font-semibold">{methodLabels[paymentData.method]}</p>
                <MoneyDisplay amount={paymentData.amount} className="text-xs font-bold" />
                {paymentData.creditAssigned !== undefined && paymentData.creditAssigned > 0 && (
                    <div className="text-[10px] text-warning font-semibold flex items-center gap-1">
                        Crédito: <MoneyDisplay amount={paymentData.creditAssigned} inline />
                    </div>
                )}
            </div>
        ) : undefined
    })

    return (
        <WizardStepsSidebar
            title="Proceso de Venta"
            currentStep={currentStep}
            steps={steps}
        />
    )
}
