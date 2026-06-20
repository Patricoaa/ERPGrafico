import { DataCell, createEntityActions } from '@/components/shared'
import { ArrowRight, DollarSign, History as HistoryIcon } from 'lucide-react'

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

    return (
        <>
            {showPaymentButton && (
                <DataCell.Action
                    icon={isFullyPaid ? HistoryIcon : DollarSign}
                    title={isFullyPaid ? "Ver Pagos" : "Pagar"}
                    onClick={(e) => { e.stopPropagation(); ctx.onPayment(period) }}
                    className={isFullyPaid ? "text-success" : "text-success"}
                />
            )}
            {canOpenChecklist && (
                <DataCell.Action
                    icon={ArrowRight}
                    title="Iniciar declaración/cierre F29"
                    onClick={(e) => { e.stopPropagation(); ctx.onWizard(period) }}
                />
            )}
        </>
    )
})
