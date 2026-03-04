"use client"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { FileText, Package, Receipt, Banknote } from "lucide-react"
import { cn, translateStatus } from "@/lib/utils"
import { getPurchaseHubStatuses } from "@/lib/purchase-order-status-utils"

interface PurchaseOrderHubStatusProps {
    order: any
}

// Helper for rendering badges - defined outside to avoid recreation during render
const StatusBadge = ({ icon: Icon, status, tooltip }: { icon: any, status: string, tooltip: string }) => {
    const colors: Record<string, string> = {
        success: "text-green-600 bg-green-500/10 border-green-600/20",
        active: "text-blue-600 bg-blue-500/10 border-blue-600/20",
        neutral: "text-muted-foreground bg-muted/50 border-muted-foreground/20",
        destructive: "text-red-600 bg-red-500/10 border-red-600/20",
        not_applicable: "hidden"
    }

    if (status === 'not_applicable') return null

    return (
        <Tooltip>
            <TooltipTrigger>
                <div className={cn("flex items-center justify-center w-6 h-6 rounded-full border", colors[status])}>
                    <Icon className="h-3 w-3" />
                </div>
            </TooltipTrigger>
            <TooltipContent>
                <p>{tooltip}</p>
            </TooltipContent>
        </Tooltip>
    )
}

export function PurchaseOrderHubStatus({ order }: PurchaseOrderHubStatusProps) {
    const statuses = getPurchaseHubStatuses(order)

    const originLabel = translateStatus(order.status)

    // Calculate reception progress for tooltip
    const lines = order.lines || order.items || []
    const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)
    let receptionProgress = 0
    if (totalOrdered > 0) {
        const totalReceived = lines.reduce((acc: number, line: any) => {
            const received = (line.quantity_received || 0)
            return acc + (parseFloat(received) || 0)
        }, 0)
        receptionProgress = Math.min(100, Math.round((totalReceived / totalOrdered) * 100))
    } else if (lines.length > 0) {
        receptionProgress = 100
    }

    const pendingAmount = parseFloat(order.pending_amount)
    const total = parseFloat(order.total)
    const paidPct = total > 0 ? ((1 - (pendingAmount / total)) * 100).toFixed(0) : "0"

    return (
        <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={0}>
                <StatusBadge
                    icon={FileText}
                    status={statuses.origin}
                    tooltip={`Origen: ${originLabel}`}
                />
                <StatusBadge
                    icon={Package}
                    status={statuses.reception}
                    tooltip={`Recepción: ${receptionProgress}%`}
                />
                <StatusBadge
                    icon={Receipt}
                    status={statuses.billing}
                    tooltip={statuses.billing === 'success' ? "Facturado" : "Pendiente de Facturación"}
                />
                <StatusBadge
                    icon={Banknote}
                    status={statuses.treasury}
                    tooltip={`Tesorería: ${paidPct}% Pagado${statuses.hasPendingTransactions ? ' - falta N° de transacción' : ''}`}
                />
            </TooltipProvider>
        </div>
    )
}
