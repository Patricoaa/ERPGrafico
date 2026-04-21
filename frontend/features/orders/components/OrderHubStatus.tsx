import React from "react"
import { ClipboardList, Package, Receipt, Banknote, FileText } from "lucide-react"
import { translateStatus } from "@/lib/utils"
import { getHubStatuses } from "@/lib/order-status-utils"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Order, OrderLine } from "../types"

interface OrderHubStatusProps {
    order: Order
}

export function OrderHubStatus({ order }: OrderHubStatusProps) {
    const statuses = getHubStatuses(order)
    // Visible if order has manufacturable items or existing work orders
    const showProduction = (order.work_orders?.length || 0) > 0 || (order.lines || order.items || []).some((l: OrderLine) => l.is_manufacturable)
    const totalOTProgress = (order as Record<string, unknown>).production_progress as number || 0

    const lines = order.lines || order.items || []
    const totalOrdered = lines.reduce((acc: number, line: OrderLine) => acc + (parseFloat(line.quantity as string) || 0), 0)
    let logisticsProgress = 0
    if (totalOrdered > 0) {
        const totalProcessed = lines.reduce((acc: number, line: OrderLine) => {
            const processed = (line.quantity_delivered || 0)
            return acc + (parseFloat(processed as string) || 0)
        }, 0)
        logisticsProgress = Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
    } else if (lines.length > 0) {
        logisticsProgress = 100
    }

    const pendingAmount = parseFloat(String(order.pending_amount || 0))
    const total = parseFloat(String(order.total || 0))
    const paidPct = total > 0 ? ((1 - (pendingAmount / total)) * 100).toFixed(0) : "0"
    const originLabel = translateStatus(order.status)

    return (
        <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={0}>
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={FileText}
                    status={statuses.origin || 'info'}
                    tooltip={`Origen: ${originLabel}`}
                />
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Receipt}
                    status={statuses.billing || 'info'}
                    tooltip={statuses.billing === 'success' ? "Facturado" : "Pendiente de Facturación"}
                />
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Banknote}
                    status={statuses.treasury || 'info'}
                    tooltip={`Tesorería: ${paidPct}% Pagado${statuses.hasPendingTransactions ? ' - falta N° de transacción' : ''}`}
                />
                {showProduction && (
                    <StatusBadge
                        variant="hub"
                        size="sm"
                        icon={ClipboardList}
                        status={statuses.production || 'info'}
                        tooltip={`Producción: ${totalOTProgress}%`}
                    />
                )}
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Package}
                    status={statuses.logistics || 'info'}
                    tooltip={`Logística: ${logisticsProgress}%`}
                />
            </TooltipProvider>
        </div>
    )
}
