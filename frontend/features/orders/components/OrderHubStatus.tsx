import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ClipboardList, Package, Receipt, Banknote, FileText } from "lucide-react"
import { cn, translateStatus } from "@/lib/utils"
import { getHubStatuses } from "@/lib/order-status-utils"

interface OrderHubStatusProps {
    order: any
}

export function OrderHubStatus({ order }: OrderHubStatusProps) {
    const statuses = getHubStatuses(order)
    // Visible if order has manufacturable items or existing work orders
    const showProduction = order.work_orders?.length > 0 || (order.lines || order.items || []).some((l: any) => l.is_manufacturable)
    const totalOTProgress = order.production_progress || 0

    const lines = order.lines || order.items || []
    const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity) || 0), 0)
    let logisticsProgress = 0
    if (totalOrdered > 0) {
        const totalProcessed = lines.reduce((acc: number, line: any) => {
            const processed = (line.quantity_delivered || 0)
            return acc + (parseFloat(processed) || 0)
        }, 0)
        logisticsProgress = Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
    } else if (lines.length > 0) {
        logisticsProgress = 100
    }

    const pendingAmount = parseFloat(order.pending_amount || 0)
    const total = parseFloat(order.total || 0)
    const paidPct = total > 0 ? ((1 - (pendingAmount / total)) * 100).toFixed(0) : "0"
    const originLabel = translateStatus(order.status)

    // Helper for rendering badges
    const StatusBadge = ({ icon: Icon, status, tooltip }: { icon: any, status: string, tooltip: string }) => {
        const colors: Record<string, string> = {
            success: "text-emerald-700 bg-green-500/10 border-green-600/20",
            active: "text-primary bg-primary/10 border-blue-600/20",
            neutral: "text-muted-foreground bg-muted/50 border-muted-foreground/20",
            destructive: "text-destructive bg-destructive/10 border-red-600/20",
            not_applicable: "hidden"
        }

        if (status === 'not_applicable') return null

        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("flex items-center justify-center w-6 h-6 rounded-full border cursor-help", colors[status])}>
                        <Icon className="h-3 w-3" />
                    </div>
                </TooltipTrigger>
                <TooltipContent>
                    <p>{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        )
    }

    return (
        <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={0}>
                <StatusBadge
                    icon={FileText}
                    status={statuses.origin}
                    tooltip={`Origen: ${originLabel}`}
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
                {showProduction && (
                    <StatusBadge
                        icon={ClipboardList}
                        status={statuses.production}
                        tooltip={`Producción: ${totalOTProgress}%`}
                    />
                )}
                <StatusBadge
                    icon={Package}
                    status={statuses.logistics}
                    tooltip={`Logística: ${logisticsProgress}%`}
                />
            </TooltipProvider>
        </div>
    )
}
