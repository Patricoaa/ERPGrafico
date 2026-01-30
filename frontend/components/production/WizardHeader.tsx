"use client"

import { Badge } from "@/components/ui/badge"
import { CalendarIcon } from "lucide-react"

interface WizardHeaderProps {
    order: any
    viewingStepIndex: number
    stagesCount: number
}

export function WizardHeader({ order, viewingStepIndex, stagesCount }: WizardHeaderProps) {
    return (
        <div className="space-y-2">
            <div className="flex items-center gap-3">
                <span className="font-bold">Gestión de Orden de Trabajo OT-{order?.number}</span>
                {order?.outsourcing_status === 'partial' && (
                    <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                        Parcialmente Tercerizado
                    </Badge>
                )}
                {order?.outsourcing_status === 'full' && (
                    <Badge variant="secondary" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">
                        Totalmente Tercerizado
                    </Badge>
                )}
            </div>

            <span className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="truncate max-w-[300px]">
                    {order?.description}
                </span>
                <span>•</span>
                <span>
                    Cliente: {order?.sale_order_client_name || order?.sale_customer_name || 'Manual'}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5 text-primary">
                    <CalendarIcon className="h-3 w-3" />
                    {order?.start_date ?
                        new Date(order.start_date + 'T12:00:00').toLocaleDateString('es-CL', { day: '2-digit', month: '2-digit', year: 'numeric' }) :
                        "Sin fecha de inicio"}
                </span>
            </span>
        </div>
    )
}
