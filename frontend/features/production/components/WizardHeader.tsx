"use client"

import { CalendarIcon, BookTemplate } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import type { WorkOrder } from "../types"
import { formatEntityDisplay } from "@/lib/entity-registry"

interface WizardHeaderProps {
    order: WorkOrder | null
    currentStageLabel: string
    onEdit: () => void
    onOpenCommandCenter: (id: number, type: 'sale' | 'purchase') => void
    onAnnul: () => void
    onDelete: () => void
    onDuplicate: () => void
    onSaveAsTemplate?: () => void
    isAnnuling: boolean
    isDeleting: boolean
    isDuplicating: boolean
}

export function WizardHeader({
    order,
    currentStageLabel,
    onEdit,
    onOpenCommandCenter,
    onAnnul,
    onDelete,
    onDuplicate,
    onSaveAsTemplate,
    isAnnuling,
    isDeleting,
    isDuplicating
}: WizardHeaderProps) {
    const customerName = order?.sale_customer_name || "Manual"
    const creationDate = order?.created_at ? formatPlainDate(order.created_at) : ''

    if (!order) {
        return (
            <div className="flex items-center w-full pr-8">
                <div className="space-y-1 flex-1">
                    <h2 className="text-xl font-bold tracking-tight">Crear Orden de Trabajo</h2>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        Planificación de Producción • Nueva OT
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="flex items-center justify-between w-full pr-8">
            <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight">Gestión de orden de trabajo</h2>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    <span>{formatEntityDisplay('production.workorder', order)}</span>
                    <span className="text-muted-foreground/30">|</span>
                    <span>{customerName}</span>
                    <span className="text-muted-foreground/30">|</span>
                    <div className="flex items-center gap-1.5">
                        <CalendarIcon className="h-3 w-3" />
                        <span>{creationDate}</span>
                    </div>
                </div>
            </div>
        </div>
    )
}