"use client"

import { Factory, FileText, CreditCard, Package, Truck, Eye, Shuffle } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { DrawerResizableRail, MoneyDisplay, WizardStepsSidebar, type WizardSidebarStep } from "@/components/shared"
import { TooltipProvider } from "@/components/ui/tooltip"

import type { NoteType, NoteWizardStepId } from "../../types"

interface NoteProcessSidebarProps {
    /** Secuencia real de pasos (dinámica según líneas y tipo de nota) */
    stepsSequence: NoteWizardStepId[]
    /** 1-based */
    currentStep: number
    noteType: NoteType
    itemsCount: number
    dteNumber?: string
    paymentData?: {
        method: string
        amount: number
    }
    collapsed?: boolean
    onToggleCollapsed?: () => void
    /** Índice 0-based del paso clicado */
    onStepClick?: (index: number) => void
}

const METHOD_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    CREDIT_CARD: 'T. Crédito',
    TRANSFER: 'Transferencia',
    CREDIT: 'Crédito',
}

const STEP_META: Record<NoteWizardStepId, { label: string; icon: LucideIcon }> = {
    'type-selector': { label: 'Tipo de Nota', icon: Shuffle },
    items: { label: 'Productos', icon: Package },
    manufacturing: { label: 'Producción', icon: Factory },
    logistics: { label: 'Logística', icon: Truck },
    registration: { label: 'Documento', icon: FileText },
    review: { label: 'Revisión', icon: Eye },
    payment: { label: 'Pago', icon: CreditCard },
}

export function NoteProcessSidebar({
    stepsSequence,
    currentStep,
    noteType,
    itemsCount,
    dteNumber,
    paymentData,
    collapsed,
    onToggleCollapsed,
    onStepClick,
}: NoteProcessSidebarProps) {
    const detailFor = (id: NoteWizardStepId) => {
        switch (id) {
            case 'type-selector':
                return <p className="text-3xs font-semibold">{noteType === 'NOTA_CREDITO' ? 'Nota de Crédito' : 'Nota de Débito'}</p>
            case 'items':
                return itemsCount > 0 ? <p className="text-3xs font-semibold">{itemsCount} productos seleccionados</p> : undefined
            case 'manufacturing':
                return <p className="text-3xs font-semibold">Producción configurada</p>
            case 'logistics':
                return <p className="text-3xs font-semibold">Movimiento registrado</p>
            case 'registration':
                return <p className="text-3xs font-semibold">{dteNumber ? `Folio: ${dteNumber}` : 'Documento registrado'}</p>
            case 'payment':
                return paymentData?.method ? (
                    <div className="space-y-0.5">
                        <p className="text-3xs font-semibold">{METHOD_LABELS[paymentData.method] ?? paymentData.method}</p>
                        <p className="text-3xs font-bold"><MoneyDisplay amount={paymentData.amount} inline /></p>
                    </div>
                ) : undefined
            default:
                return undefined
        }
    }

    const steps: WizardSidebarStep[] = stepsSequence.map((id) => ({
        id,
        label: STEP_META[id].label,
        icon: STEP_META[id].icon,
        detail: detailFor(id),
    }))

    return (
        <TooltipProvider delayDuration={300}>
            <DrawerResizableRail
                side="left"
                collapsed={collapsed}
                onToggleCollapsed={onToggleCollapsed}
                storageKey="erpgrafico.notes.railCollapsed"
                defaultWidth={256}
                minWidth={200}
                maxWidth={420}
                compactWidth={56}
                ariaLabel="Redimensionar proceso de nota"
                className="hidden md:flex"
            >
                <WizardStepsSidebar
                    title={noteType === 'NOTA_CREDITO' ? 'Proceso Nota Crédito' : 'Proceso Nota Débito'}
                    currentStep={currentStep}
                    steps={steps}
                    width="w-full"
                    className="bg-transparent flex-1 min-h-0"
                    onStepClick={onStepClick}
                    showNumbers
                    detailVisibility="both"
                    showCounter={false}
                    showConnector={false}
                    listClassName="px-2 pt-1 space-y-1.5"
                    collapsed={collapsed}
                    onToggleCollapsed={onToggleCollapsed}
                />
            </DrawerResizableRail>
        </TooltipProvider>
    )
}
