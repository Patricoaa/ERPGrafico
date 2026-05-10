"use client"

import { CalendarIcon, Pencil, LayoutDashboard, Ban, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPlainDate, cn, formatCurrency } from "@/lib/utils"
import { StatusBadge } from "@/components/shared/StatusBadge"
import type { WorkOrder } from "../types"
import { formatEntityDisplay } from "@/lib/entity-registry"

interface WizardHeaderProps {
    order: WorkOrder
    currentStageLabel: string
    onEdit: () => void
    onOpenCommandCenter: (id: number, type: 'sale' | 'purchase') => void
    onAnnul: () => void
    onDelete: () => void
    isAnnuling: boolean
    isDeleting: boolean
}

export function WizardHeader({
    order,
    currentStageLabel,
    onEdit,
    onOpenCommandCenter,
    onAnnul,
    onDelete,
    isAnnuling,
    isDeleting
}: WizardHeaderProps) {
    const canEditOrDelete = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order?.current_stage)
    const customerName = order?.sale_customer_name || "Manual"
    const creationDate = formatPlainDate(order?.created_at)

    return (
        <div className="flex items-center justify-between w-full pr-8">
            <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight">Gestión de orden de trabajo</h2>
                    <StatusBadge status={order?.status || 'PENDING'} />
                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground whitespace-nowrap">
                        {currentStageLabel}
                    </span>
                    <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-border bg-muted/50 text-muted-foreground whitespace-nowrap">
                        {formatCurrency(order?.total_price || 0)}
                    </span>
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

            <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-lg border border-border/50">
                {canEditOrDelete && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEdit}
                        title="Editar OT"
                        className="h-8 w-8 p-0 hover:bg-background hover:shadow-sm"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => order?.sale_order && onOpenCommandCenter(order.sale_order.id, 'sale')}
                    title="Configuración de Venta"
                    className="h-8 w-8 p-0 hover:bg-background hover:shadow-sm"
                    disabled={!order?.sale_order}
                >
                    <LayoutDashboard className="h-4 w-4" />
                </Button>
                <div className="w-[1px] h-4 bg-border/60 mx-1" />
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-warning hover:text-warning hover:bg-warning/10"
                    onClick={onAnnul}
                    disabled={isAnnuling || order?.status === 'CANCELLED' || order?.is_cancellable === false}
                    title={order?.is_cancellable === false ? "Anulación no permitida en esta etapa" : "Anular OT"}
                >
                    <Ban className="h-4 w-4" />
                </Button>
                {canEditOrDelete && (
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={onDelete}
                        disabled={isDeleting}
                        title="Eliminar OT"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    )
}
