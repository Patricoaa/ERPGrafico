import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ClipboardList, Package, Receipt, Banknote, FileText } from "lucide-react"
import { cn, translateStatus } from "@/lib/utils"
import { getInvoiceHubStatuses } from "@/lib/order-status-utils"

interface InvoiceHubStatusProps {
    invoice: any
}

export function InvoiceHubStatus({ invoice }: InvoiceHubStatusProps) {
    const statuses = getInvoiceHubStatuses(invoice)

    // Helper for rendering badges - copied from OrderHubStatus for consistency
    const StatusBadge = ({ icon: Icon, status, tooltip }: { icon: any, status: string, tooltip: string }) => {
        const colors: Record<string, string> = {
            success: "text-green-600 bg-green-500/10 border-green-600/20",
            active: "text-blue-600 bg-blue-500/10 border-blue-600/20",
            neutral: "text-muted-foreground bg-muted/50 border-muted-foreground/20",
            destructive: "text-red-600 bg-red-500/10 border-red-600/20",
            not_applicable: "hidden" // Or use a fainter style
        }

        if (status === 'not_applicable') return null

        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <div className={cn("flex items-center justify-center w-6 h-6 rounded-full border cursor-help", colors[status] || colors.neutral)}>
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
                {/* Origin */}
                <StatusBadge
                    icon={FileText}
                    status={statuses.origin}
                    tooltip={`Documento: ${translateStatus(invoice.status)}`}
                />

                {/* Logistics */}
                <StatusBadge
                    icon={Package}
                    status={statuses.logistics}
                    tooltip={statuses.logistics === 'success' ? "Logística: Completada" : statuses.logistics === 'active' ? `Logística: ${statuses.logisticsProgress}%` : "Logística: Pendiente"}
                />

                {/* Billing */}
                <StatusBadge
                    icon={Receipt}
                    status={statuses.billing}
                    tooltip={statuses.billing === 'success' ? "Folio Generado" : "Pendiente de Folio"}
                />

                {/* Treasury */}
                <StatusBadge
                    icon={Banknote}
                    status={statuses.treasury}
                    tooltip={statuses.treasury === 'success' ? "Pagado" : statuses.treasury === 'active' ? "Pago Parcial / Pendiente TR" : "Pendiente de Pago"}
                />
            </TooltipProvider>
        </div>
    )
}
