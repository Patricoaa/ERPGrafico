import { createEntityActions } from '@/components/shared'
import { TrendingUp, Banknote, ArrowRightLeft, HandCoins } from 'lucide-react'
import type { Partner } from '@/features/contacts'

export interface PartnerActionsCtx {
    onFormalizeExcessCapital: (id: number, amount: string) => void
    onRegisterContribution: (id: number, amount: string) => void
    onPayDividends: (id: number) => void
    onDistributeEarnings: (id: number) => void
    onViewLedger: (id: number) => void
}

export const partnerActions = createEntityActions<
    Partner,
    PartnerActionsCtx
>((item, ctx) => {
    const hasEarnings = parseFloat(item.partner_earnings_balance) > 0
    const hasDividends = parseFloat(item.partner_dividends_payable_balance) > 0
    const hasPendingCapital = parseFloat(item.partner_pending_capital) > 0

    return [
        {
            action: "detail",
            icon: TrendingUp,
            label: "Formalizar Exceso de Capital",
            className: "text-warning",
            onClick: () => ctx.onFormalizeExcessCapital(item.id, item.partner_excess_capital),
            visible: parseFloat(item.partner_excess_capital) > 0,
        },
        {
            action: "pay",
            icon: HandCoins,
            label: "Registrar Pago de Capital Pendiente",
            className: "text-primary",
            onClick: () => ctx.onRegisterContribution(item.id, item.partner_pending_capital),
            visible: hasPendingCapital,
        },
        {
            action: "pay",
            icon: Banknote,
            label: "Pagar Dividendos",
            className: hasDividends ? "text-primary" : "text-muted-foreground/30 pointer-events-none",
            onClick: () => ctx.onPayDividends(item.id),
        },
        {
            action: "detail",
            icon: ArrowRightLeft,
            label: "Distribuir Utilidades Retenidas",
            className: hasEarnings ? "text-primary/70" : "text-muted-foreground/30 pointer-events-none",
            onClick: () => ctx.onDistributeEarnings(item.id),
        },
        {
            action: "history",
            label: "Ver Libro Auxiliar",
            className: "text-primary font-black",
            onClick: () => ctx.onViewLedger(item.id),
        },
    ]
})
