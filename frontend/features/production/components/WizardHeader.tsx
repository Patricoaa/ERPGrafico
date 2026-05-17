"use client"
import { formatCurrency } from "@/lib/money"

import { CalendarIcon, BookTemplate } from "lucide-react"
import { formatPlainDate } from "@/lib/utils"
import { Chip, DataCell, StatusBadge } from "@/components/shared"
import type { WorkOrder } from "../types"
import { formatEntityDisplay } from "@/lib/entity-registry"

interface WizardHeaderProps {
    order: WorkOrder
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
    const canEditOrDelete = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order?.current_stage)
    const customerName = order?.sale_customer_name || "Manual"
    const creationDate = formatPlainDate(order?.created_at)

    return (
        <div className="flex items-center justify-between w-full pr-8">
            <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight">Gestión de orden de trabajo</h2>
                    <StatusBadge status={order?.status || 'PENDING'} size="md" />
                    <Chip size="xs">{currentStageLabel}</Chip>
                    <Chip size="xs">{formatCurrency(order?.total_price || 0)}</Chip>
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

            <DataCell.ActionGroup>
                {canEditOrDelete && (
                    <DataCell.Action action="edit" onClick={onEdit} />
                )}
                <DataCell.Action
                    action="hub"
                    title="Configuración de Venta"
                    onClick={() => order?.sale_order && onOpenCommandCenter(order.sale_order.id, 'sale')}
                    disabled={!order?.sale_order}
                />
                <div className="w-[1px] h-4 bg-border/60 mx-1" />
                <DataCell.Action
                    action="duplicate"
                    onClick={onDuplicate}
                    disabled={isDuplicating}
                />
                {onSaveAsTemplate && (
                    <DataCell.Action
                        icon={BookTemplate}
                        title="Guardar como plantilla"
                        onClick={onSaveAsTemplate}
                    />
                )}
                <DataCell.Action
                    action="annul"
                    title={order?.is_cancellable === false ? "Anulación no permitida en esta etapa" : "Anular OT"}
                    onClick={onAnnul}
                    disabled={isAnnuling || order?.status === 'CANCELLED' || order?.is_cancellable === false}
                />
                {canEditOrDelete && (
                    <DataCell.Action
                        action="delete"
                        onClick={onDelete}
                        disabled={isDeleting}
                    />
                )}
            </DataCell.ActionGroup>
        </div>
    )
}
