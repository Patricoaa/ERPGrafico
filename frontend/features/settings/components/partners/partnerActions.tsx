import { DataCell, createEntityActions } from '@/components/shared'
import { TrendingUp, Banknote, ArrowRightLeft, History } from 'lucide-react'
import type { Partner } from '@/features/contacts/types/partner'

export interface PartnerActionsCtx {
    onFormalizeExcessCapital: (id: number, amount: string) => void
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

    return (
        <>
            {parseFloat(item.partner_excess_capital) > 0 && (
                <DataCell.Action icon={TrendingUp} title="Formalizar Exceso de Capital" className="text-warning" onClick={() => ctx.onFormalizeExcessCapital(item.id, item.partner_excess_capital)} />
            )}
            <DataCell.Action icon={Banknote} title="Pagar Dividendos" className={hasDividends ? "text-primary" : "text-muted-foreground/30 pointer-events-none"} onClick={() => ctx.onPayDividends(item.id)} />
            <DataCell.Action icon={ArrowRightLeft} title="Distribuir Utilidades Retenidas" className={hasEarnings ? "text-primary/70" : "text-muted-foreground/30 pointer-events-none"} onClick={() => ctx.onDistributeEarnings(item.id)} />
            <DataCell.Action icon={History} title="Ver Libro Auxiliar" className="text-primary font-black" onClick={() => ctx.onViewLedger(item.id)} />
        </>
    )
})
