"use client"

import { FileText, Package, CreditCard, ShoppingBag, Truck } from "lucide-react"
import { MoneyDisplay, WizardStepsSidebar, type WizardSidebarStep } from "@/components/shared"

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
    'CREDIT_CARD': 'T. Crédito',
    'TRANSFER': 'Transferencia',
    'CREDIT': 'Crédito'
}

export function NoteProcessSidebar({
    currentStep,
    noteType,
    requiresLogistics,
    hasManufacturing,
    itemsCount,
    dteNumber,
    paymentData
}: NoteProcessSidebarProps) {
    const steps: WizardSidebarStep[] = [
        {
            id: 'items',
            label: 'Productos',
            icon: Package,
            detail: itemsCount > 0 ? (
                <p className="text-xs font-semibold">{itemsCount} productos seleccionados</p>
            ) : undefined
        },
    ]

    if (hasManufacturing) {
        steps.push({
            id: 'manufacturing',
            label: 'Producción',
            icon: ShoppingBag,
            detail: <p className="text-xs font-semibold">Producción configurada</p>
        })
    }

    if (requiresLogistics) {
        steps.push({
            id: 'logistics',
            label: 'Logística',
            icon: Truck,
            detail: <p className="text-xs font-semibold">Movimiento registrado</p>
        })
    }

    steps.push(
        {
            id: 'dte',
            label: 'Documento',
            icon: FileText,
            detail: (
                <p className="text-xs font-semibold">
                    {dteNumber ? `Folio: ${dteNumber}` : 'Documento registrado'}
                </p>
            )
        },
        {
            id: 'payment',
            label: 'Pago',
            icon: CreditCard,
            detail: paymentData?.method ? (
                <div className="space-y-0.5">
                    <p className="text-xs font-semibold">{methodLabels[paymentData.method]}</p>
                    <p className="text-xs font-bold">
                        <MoneyDisplay amount={paymentData.amount} inline />
                    </p>
                </div>
            ) : undefined
        }
    )

    return (
        <WizardStepsSidebar
            title={noteType === 'NOTA_CREDITO' ? 'Proceso Nota Crédito' : 'Proceso Nota Débito'}
            currentStep={currentStep}
            steps={steps}
        />
    )
}
