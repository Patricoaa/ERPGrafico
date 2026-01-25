import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ClipboardList, Package, Receipt, Banknote, FileText } from "lucide-react"
import { cn, translateStatus } from "@/lib/utils"

interface NoteHubStatusProps {
    note: any
}

export function NoteHubStatus({ note }: NoteHubStatusProps) {
    // Logic for Note Statuses

    // 1. Origin (The Note itself)
    let originStatus = 'neutral'
    if (note.status === 'CANCELLED') originStatus = 'destructive'
    else if (note.status !== 'DRAFT') originStatus = 'success'

    // 2. Production (Usually N/A for Notes, unless we link to OT, but let's keep it simple or hidden)
    // For now, hidden as Notes usually rectify quantity/amount, not production directly.
    const showProduction = false // Or check if note.related_production_orders exists if added later

    // 3. Logistics (Returns/Receptions)
    // Check related stock moves
    const stockMoves = note.related_stock_moves || []
    let logStatus = 'neutral'
    if (stockMoves.length === 0) {
        logStatus = 'not_applicable' // Or 'neutral' if we want to show it as "No movement needed"
    } else {
        const allDone = stockMoves.every((m: any) => m.state === 'DONE' || m.state === 'CANCELLED')
        logStatus = allDone ? 'success' : 'active'
    }

    // 4. Billing (The Note is the billing document)
    // If it's posted/paid, it's success.
    let billingStatus = 'neutral'
    if (note.status === 'POSTED' || note.status === 'PAID') billingStatus = 'success'
    else if (note.status === 'DRAFT') billingStatus = 'neutral'


    // 5. Treasury (Payment of the Note)
    // If it's a Credit Note, it might be applied to an Invoice (paid) or refunded.
    // If it's a Debit Note, it needs to be paid.
    let treasuryStatus = 'neutral'
    if (note.status === 'PAID') treasuryStatus = 'success'
    else if (note.payment_status === 'PAID') treasuryStatus = 'success'
    else if (parseFloat(note.pending_amount) < parseFloat(note.total)) treasuryStatus = 'active'


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
                    status={originStatus}
                    tooltip={`Documento: ${translateStatus(note.status)}`}
                />

                {/* Production - Hidden for now */}
                {showProduction && (
                    <StatusBadge
                        icon={ClipboardList}
                        status={'neutral'}
                        tooltip="Producción"
                    />
                )}

                {/* Logistics */}
                <StatusBadge
                    icon={Package}
                    status={logStatus}
                    tooltip={stockMoves.length > 0 ? `Logística (${stockMoves.length} movimientos)` : "Sin movimientos"}
                />

                {/* Billing */}
                <StatusBadge
                    icon={Receipt}
                    status={billingStatus}
                    tooltip={`Facturación: ${translateStatus(note.status)}`}
                />

                {/* Treasury */}
                <StatusBadge
                    icon={Banknote}
                    status={treasuryStatus}
                    tooltip={`Tesorería: ${translateStatus(note.payment_status || note.status)}`}
                />
            </TooltipProvider>
        </div>
    )
}
