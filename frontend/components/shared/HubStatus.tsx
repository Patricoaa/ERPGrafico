import React from "react"
import { ClipboardList, Package, Receipt, Banknote, FileText } from "lucide-react"
import { StatusBadge } from "./StatusBadge"
import { TooltipProvider } from "@/components/ui/tooltip"
import { getEntityMetadata } from "@/lib/entity-registry"
import { getHubStatuses, getInvoiceHubStatuses, getNoteHubStatuses } from "@/lib/workflow-status"
import { translateStatus } from "@/lib/utils"

export interface HubStatusData {
    origin: string
    production?: string
    billing: string
    treasury: string
    logistics: string
    // Tooltips or progress values
    tooltips?: {
        origin?: string
        production?: string
        billing?: string
        treasury?: string
        logistics?: string
    }
}

interface HubStatusProps {
    statuses: HubStatusData
    className?: string
}

/**
 * Unified Hub Status component for Orders, Invoices, and other workflow entities.
 * Renders the canonical 5-stage workflow status indicators.
 */
export function HubStatus({ statuses, className }: HubStatusProps) {
    const { tooltips = {} } = statuses

    return (
        <div className={className || "flex items-center gap-1.5"}>
            <TooltipProvider delayDuration={0}>
                {/* 1. Origin */}
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={FileText}
                    status={statuses.origin || 'info'}
                    tooltip={tooltips.origin}
                />

                {/* 2. Production (Optional) */}
                {statuses.production && statuses.production !== 'not_applicable' && (
                    <StatusBadge
                        variant="hub"
                        size="sm"
                        icon={ClipboardList}
                        status={statuses.production}
                        tooltip={tooltips.production}
                    />
                )}

                {/* 3. Billing */}
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Receipt}
                    status={statuses.billing || 'info'}
                    tooltip={tooltips.billing}
                />

                {/* 4. Treasury */}
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Banknote}
                    status={statuses.treasury || 'info'}
                    tooltip={tooltips.treasury}
                />

                {/* 5. Logistics */}
                {statuses.logistics !== 'not_applicable' && (
                    <StatusBadge
                        variant="hub"
                        size="sm"
                        icon={Package}
                        status={statuses.logistics || 'info'}
                        tooltip={tooltips.logistics}
                    />
                )}
            </TooltipProvider>
        </div>
    )
}

interface DomainHubStatusProps {
    label: string
    data: any
    className?: string
}

/**
 * Data-driven Hub Status. Calculates workflow states automatically based on entity label and data.
 */
export function DomainHubStatus({ label, data, className }: DomainHubStatusProps) {
    const meta = getEntityMetadata(label)
    if (!meta?.workflowType) return null

    let statuses: any
    let tooltips: any = {}

    if (meta.workflowType === 'order') {
        const s = getHubStatuses(data)
        statuses = s

        // Tooltip logic (moved from OrderHubStatus)
        const pendingAmount = parseFloat(String(data.pending_amount || 0))
        const total = parseFloat(String(data.total || 0))
        const paidPct = total > 0 ? ((1 - (pendingAmount / total)) * 100).toFixed(0) : "0"

        const showProduction = (data.work_orders?.length || 0) > 0 || (data.lines || data.items || []).some((l: any) => l.is_manufacturable)
        const totalOTProgress = data.production_progress || 0

        const lines = data.lines || data.items || []
        const totalOrdered = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity as string) || 0), 0)
        let logisticsProgress = 0
        if (totalOrdered > 0) {
            const totalProcessed = lines.reduce((acc: number, line: any) => acc + (parseFloat(line.quantity_delivered || line.quantity_received || 0) || 0), 0)
            logisticsProgress = Math.min(100, Math.round((totalProcessed / totalOrdered) * 100))
        }

        tooltips = {
            origin: `Origen: ${translateStatus(data.status)}`,
            billing: s.billing === 'success' ? "Facturado" : "Pendiente de Facturación",
            treasury: `Tesorería: ${paidPct}% Pagado${s.hasPendingTransactions ? ' - falta N° de transacción' : ''}`,
            production: showProduction ? `Producción: ${totalOTProgress}%` : undefined,
            logistics: `Logística: ${logisticsProgress}%`
        }
    } else if (meta.workflowType === 'invoice') {
        const isNote = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(data.dte_type)
        const s = isNote ? getNoteHubStatuses(data) : getInvoiceHubStatuses(data)
        statuses = s

        tooltips = {
            origin: (() => {
                if (isNote) {
                    const source = data.corrected_invoice?.display_id || data.corrected_invoice?.number || "Factura"
                    const order = data.sale_order_number || data.purchase_order_number || ""
                    return `Origen: ${source}${order ? ` (${order})` : ''}`
                }
                return `Documento: ${translateStatus(data.status)}`
            })(),
            logistics: (() => {
                if (isNote) {
                    const docs = data.related_documents || {}
                    if ((docs.deliveries?.length || 0) > 0) return `Logística (${docs.deliveries.length} despachos)`
                    if ((docs.receipts?.length || 0) > 0) return `Logística (${docs.receipts.length} recepciones)`
                    if ((data.related_stock_moves?.length || 0) > 0) return `Logística (${data.related_stock_moves.length} movimientos)`
                    return "Sin movimientos"
                }
                return s.logistics === 'success' ? "Logística: Completada" : s.logistics === 'active' ? `Logística: ${s.logisticsProgress}%` : "Logística: Pendiente"
            })(),
            billing: (() => {
                if (isNote && data.number && data.number !== 'Draft') {
                    const prefix = data.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND'
                    const num = data.number.toString().includes(prefix) ? data.number : `${prefix}-${data.number}`
                    return `Facturación: ${num}`
                }
                return s.billing === 'success' ? "Folio Generado" : "Pendiente de Folio"
            })(),
            treasury: isNote
                ? `Tesorería: ${translateStatus(String(data.payment_status || data.status))}`
                : (s.treasury === 'success' ? "Pagado" : s.treasury === 'active' ? "Pago Parcial / Pendiente TR" : "Pendiente de Pago")
        }
    }

    if (!statuses) return null

    return <HubStatus statuses={{ ...statuses, tooltips }} className={className} />
}
