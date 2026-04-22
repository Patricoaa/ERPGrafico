import React from "react"
import { Package, Receipt, Banknote, FileText } from "lucide-react"
import { translateStatus } from "@/lib/utils"
import { getInvoiceHubStatuses } from "@/lib/order-status-utils"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { TooltipProvider } from "@/components/ui/tooltip"

import { Invoice } from "@/features/billing/types"

interface InvoiceHubStatusProps {
    invoice: Invoice | Record<string, unknown>
}

export function InvoiceHubStatus({ invoice: i }: InvoiceHubStatusProps) {
    const invoice = i as any
    const statuses = getInvoiceHubStatuses(invoice)

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
                        if (['NOTA_CREDITO', 'NOTA_DEBITO'].includes(invoice.dte_type)) {
                            const source = invoice.corrected_invoice?.display_id || invoice.corrected_invoice?.number || "Factura"
                            const order = invoice.sale_order_number || invoice.purchase_order_number || ""
                            return `Origen: ${source}${order ? ` (${order})` : ''}`
                        }
                        return `Documento: ${translateStatus(invoice.status)}`
                    })()}
                />

                {/* Logistics */}
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Package}
                    status={statuses.logistics || 'info'}
                    tooltip={statuses.logistics === 'success' ? "Logística: Completada" : statuses.logistics === 'active' ? `Logística: ${statuses.logisticsProgress}%` : "Logística: Pendiente"}
                />

                {/* Billing */}
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Receipt}
                    status={statuses.billing || 'info'}
                    tooltip={(() => {
                        if (['NOTA_CREDITO', 'NOTA_DEBITO'].includes(invoice.dte_type) && invoice.number && invoice.number !== 'Draft') {
                            const prefix = invoice.dte_type === 'NOTA_CREDITO' ? 'NC' : 'ND'
                            const num = invoice.number.toString().includes(prefix) ? invoice.number : `${prefix}-${invoice.number}`
                            return `Facturación: ${num}`
                        }
                        return statuses.billing === 'success' ? "Folio Generado" : "Pendiente de Folio"
                    })()}
                />

                {/* Treasury */}
                <StatusBadge
                    variant="hub"
                    size="sm"
                    icon={Banknote}
                    status={statuses.treasury || 'info'}
                    tooltip={statuses.treasury === 'success' ? "Pagado" : statuses.treasury === 'active' ? "Pago Parcial / Pendiente TR" : "Pendiente de Pago"}
                />
            </TooltipProvider>
        </div>
    )
}
