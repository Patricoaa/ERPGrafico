import { createEntityActions } from '@/components/shared'
import { DollarSign, History as HistoryIcon } from 'lucide-react'

export interface TaxDeclarationActionsCtx {
    onPayment: (period: unknown) => void
    onWizard: (period: unknown) => void
}

export const taxDeclarationActions = createEntityActions<unknown, TaxDeclarationActionsCtx>((period, ctx) => {
    const p = period as {
        declaration_summary?: { is_fully_paid?: boolean } | null
        status?: string
    }
    const summary = p.declaration_summary
    const isFullyPaid = summary?.is_fully_paid
    const showPaymentButton = !!summary || p.status === 'CLOSED'
    const canOpenChecklist = p.status === 'OPEN'

    return [
        {
            action: "pay",
            icon: isFullyPaid ? HistoryIcon : DollarSign,
            label: isFullyPaid ? "Ver Pagos" : "Pagar",
            className: "text-success",
            onClick: (e) => { e.stopPropagation(); ctx.onPayment(period) },
            visible: showPaymentButton,
        },
        {
            action: "detail",
            label: "Iniciar declaración/cierre F29",
            onClick: (e) => { e.stopPropagation(); ctx.onWizard(period) },
            visible: canOpenChecklist,
        },
    ]
})
