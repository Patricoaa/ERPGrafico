import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ClipboardList, Package, Receipt, Banknote, FileText } from "lucide-react"
import { cn, translateStatus } from "@/lib/utils"
import { getNoteHubStatuses } from "@/lib/order-status-utils"

interface NoteHubStatusProps {
    note: any
}

export function NoteHubStatus({ note }: NoteHubStatusProps) {
    const statuses = getNoteHubStatuses(note)
    const stockMoves = note.related_stock_moves || []


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
                {/* Origin */}
                <StatusBadge
                    icon={FileText}
                    status={statuses.origin}
                    tooltip={`Documento: ${translateStatus(note.status)}`}
                />

                {/* Logistics */}
                <StatusBadge
                    icon={Package}
                    status={statuses.logistics}
                    tooltip={stockMoves.length > 0 ? `Logística (${stockMoves.length} movimientos)` : "Sin movimientos"}
                />

                {/* Billing */}
                <StatusBadge
                    icon={Receipt}
                    status={statuses.billing}
                    tooltip={`Facturación: ${translateStatus(note.status)}`}
                />

                {/* Treasury */}
                <StatusBadge
                    icon={Banknote}
                    status={statuses.treasury}
                    tooltip={`Tesorería: ${translateStatus(note.payment_status || note.status)}`}
                />
            </TooltipProvider>
        </div>
    )
}
