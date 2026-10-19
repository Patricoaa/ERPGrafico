import { createEntityActions } from '@/components/shared'
import { DollarSign, History as HistoryIcon } from 'lucide-react'
import type { TaxPeriod } from '../types'

export interface TaxDeclarationActionsCtx {
    onPayment: (period: TaxPeriod) => void
    onWizard: (period: TaxPeriod) => void
}

export const taxDeclarationActions = createEntityActions<TaxPeriod, TaxDeclarationActionsCtx>((period, ctx) => {
    const summary = period.declaration_summary
    const isFullyPaid = summary?.is_fully_paid
    const showPaymentButton = !!summary || period.status === 'CLOSED'
    const canOpenChecklist = period.status === 'OPEN'

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
