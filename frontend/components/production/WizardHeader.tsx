"use client"

import { Badge } from "@/components/ui/badge"
import { CalendarIcon, Pencil, LayoutDashboard, Ban, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"

interface WizardHeaderProps {
    order: any
    viewingStepIndex: number
    stagesCount: number
    onEdit: () => void
    onOpenCommandCenter: (id: number, type: 'sale' | 'purchase') => void
    onAnnul: () => void
    onDelete: () => void
    isAnnuling: boolean
    isDeleting: boolean
}

export function WizardHeader({
    order,
    viewingStepIndex,
    stagesCount,
    onEdit,
    onOpenCommandCenter,
    onAnnul,
    onDelete,
    isAnnuling,
    isDeleting
}: WizardHeaderProps) {
    const canEditOrDelete = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS'].includes(order?.current_stage)

    return (
        <div className="flex items-start justify-between border-b pb-4 mb-4">
            <div className="space-y-1">
                <div className="flex items-center gap-3">
                    <span className="font-bold text-lg">Gestión de Orden de Trabajo OT-{order?.number}</span>
                    <Badge variant={order?.status === 'FINISHED' ? 'success' : order?.status === 'CANCELLED' ? 'destructive' : 'default'}>
                        {order?.status === 'FINISHED' ? 'Finalizada' : order?.status === 'CANCELLED' ? 'Anulada' : 'En Proceso'}
                    </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        <span>Etapa {viewingStepIndex + 1} de {stagesCount}</span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                {canEditOrDelete && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onEdit}
                        title="Editar OT"
                        className="h-9 w-9 p-0 hover:bg-muted"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => order?.sale_order && onOpenCommandCenter(order.sale_order, 'sale')}
                    title="Configuración de Venta"
                    className="h-9 w-9 p-0 hover:bg-muted"
                >
                    <LayoutDashboard className="h-4 w-4" />
                </Button>
                <div className="w-[1px] h-6 bg-border mx-1" />
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
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
                        className="h-9 w-9 p-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
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
