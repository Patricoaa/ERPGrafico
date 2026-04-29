import React from "react"
import { Package, Receipt, Banknote, FileText } from "lucide-react"
import { translateStatus } from "@/lib/utils"
import { getNoteHubStatuses } from '@/features/orders/utils/status'
import { StatusBadge } from "@/components/shared/StatusBadge"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Order } from "../types"

interface NoteHubStatusProps {
    note: Order
}

export function NoteHubStatus({ note }: NoteHubStatusProps) {
    const statuses = getNoteHubStatuses(note as any)

    return (
        <div className="flex items-center gap-1.5">
            <TooltipProvider delayDuration={0}>
                {/* Origin */}
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={FileText}
                    status={statuses.origin || 'info'}
                    tooltip={(() => {
                        const isNoteDocument = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(note.dte_type as string)
                        if (isNoteDocument) {
                            const source = ((note.corrected_invoice as unknown) as Record<string, unknown>)?.display_id || ((note.corrected_invoice as unknown) as Record<string, unknown>)?.number || "Factura"
                            const order = (note as unknown as Record<string, unknown>).sale_order_number || (note as unknown as Record<string, unknown>).purchase_order_number || ""
                            return `Origen: ${source}${order ? ` (${order})` : ''}`
                        }
                        return `Documento: ${translateStatus(note.status)}`
                    })()}
                />

                {/* Billing */}
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Receipt}
                    status={statuses.billing || 'info'}
                    tooltip={(() => {
                        const isNoteDocument = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(note.dte_type as string)
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
                    variant="hub"
                    size="sm"
                    icon={Banknote}
                    status={statuses.treasury || 'info'}
                    tooltip={`Tesorería: ${translateStatus(String((note as unknown as Record<string, unknown>).payment_status || note.status))}`}
                />

                {/* Logistics */}
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Package}
                    status={statuses.logistics || 'info'}
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
            </TooltipProvider>
        </div>
    )
}
