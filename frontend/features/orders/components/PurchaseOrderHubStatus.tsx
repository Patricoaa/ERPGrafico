"use client"
import React from "react"
import { FileText, Package, Receipt, Banknote } from "lucide-react"
import { translateStatus } from "@/lib/utils"
import { OrderLine, Order } from "../types"
import { getPurchaseHubStatuses } from "@/lib/purchase-order-status-utils"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { TooltipProvider } from "@/components/ui/tooltip"


interface PurchaseOrderHubStatusProps {
    order: Order
}

export function PurchaseOrderHubStatus({ order }: PurchaseOrderHubStatusProps) {
    const statuses = getPurchaseHubStatuses(order)
    const originLabel = translateStatus(order.status)

    // Calculate reception progress for tooltip
    const lines = order.lines || order.items || []
    const totalOrdered = lines.reduce((acc: number, line: OrderLine) => acc + (parseFloat(line.quantity as string) || 0), 0)
    let receptionProgress = 0
    if (totalOrdered > 0) {
        const totalReceived = lines.reduce((acc: number, line: OrderLine) => {
            const received = (line.quantity_received || 0)
            return acc + (parseFloat(received as string) || 0)
        }, 0)
        receptionProgress = Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
    } else if (lines.length > 0) {
        receptionProgress = 100
    }

    const pendingAmount = typeof order.pending_amount === 'number' ? order.pending_amount : parseFloat(String(order.pending_amount || 0))
    const total = typeof order.total === 'number' ? order.total : parseFloat(String(order.total || 0))
    const paidPct = total > 0 ? ((1 - (pendingAmount / total)) * 100).toFixed(0) : "0"

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
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Package}
                    status={statuses.reception || 'info'}
                    tooltip={`Recepción: ${receptionProgress}%`}
                />
            </TooltipProvider>
        </div>
    )
}
