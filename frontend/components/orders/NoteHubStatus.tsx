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
                    tooltip={(() => {
                        const isNoteDocument = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(note.dte_type)
                        if (isNoteDocument) {
                            const source = note.corrected_invoice?.display_id || note.corrected_invoice?.number || "Factura"
                            const order = note.sale_order_number || note.purchase_order_number || ""
                            return `Origen: ${source}${order ? ` (${order})` : ''}`
                        }
                        return `Documento: ${translateStatus(note.status)}`
                    })()}
                />

                {/* Logistics */}
                <StatusBadge
                    icon={Package}
                    status={statuses.logistics}
                    tooltip={(() => {
                        const deliveries = note.related_documents?.deliveries || []
                        const receipts = note.related_documents?.receipts || []
                        const moves = note.related_stock_moves || []

                        if (deliveries.length > 0) return `Logística (${deliveries.length} despachos)`
                        if (receipts.length > 0) return `Logística (${receipts.length} recepciones)`
                        if (moves.length > 0) return `Logística (${moves.length} movimientos)`
                        return "Sin movimientos"
                    })()}
                />

                {/* Billing */}
                <StatusBadge
                    icon={Receipt}
                    status={statuses.billing}
                    tooltip={(() => {
                        const isNoteDocument = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(note.dte_type)
                        if (isNoteDocument && note.number && note.number !== 'Draft') {
                            const prefix = note.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND'
                            const num = note.number.toString().includes(prefix) ? note.number : `${prefix}-${note.number}`
                            return `Facturación: ${num}`
                        }
                        return `Facturación: ${translateStatus(note.status)}`
                    })()}
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
