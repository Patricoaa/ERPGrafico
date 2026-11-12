import { createEntityActions } from '@/components/shared'
import { TrendingUp, Banknote, ArrowRightLeft, HandCoins, Wallet, LogOut, UserMinus } from 'lucide-react'
import type { Partner } from '@/features/contacts'
import type { PartnerActionRunner } from './partnerActionRequest'

export interface PartnerActionsCtx {
    run: PartnerActionRunner
    /** Abre la ficha del socio (omitir dentro de la propia ficha). */
    onOpen?: (id: number) => void
}

const num = (v: string | null | undefined) => parseFloat(v ?? "0") || 0

/** Un socio puede darse de baja solo sin capital ni saldos; el backend lo vuelve a validar. */
export function demoteBlockedReason(p: Partner): string | null {
    if (num(p.partner_total_contributions) > 0) return "Tiene capital suscrito: reduzca o transfiera todo su capital primero."
    if (num(p.partner_provisional_withdrawals_balance) > 0) return "Tiene retiros provisorios pendientes de liquidar."
    if (num(p.partner_earnings_balance) > 0 || num(p.partner_dividends_payable_balance) > 0) return "Tiene utilidades retenidas o dividendos por pagar."
    return null
}

/**
 * Única fuente de acciones de socio: la usan la fila de la lista y la ficha (`PartnerDrawer`).
 * La visibilidad depende del estado del socio; nada queda "tachado" por CSS.
 */
export const partnerActions = createEntityActions<
    Partner,
    PartnerActionsCtx
>((item, ctx) => [
    {
        action: "detail",
        label: "Ver ficha del socio",
        onClick: () => ctx.onOpen?.(item.id),
        visible: !!ctx.onOpen,
    },
    {
        action: "detail",
        icon: TrendingUp,
        label: "Formalizar exceso de capital",
        className: "text-warning",
        onClick: () => ctx.run({ type: "subscription", partnerId: item.id, amount: item.partner_excess_capital }),
        visible: num(item.partner_excess_capital) > 0,
    },
    {
        action: "pay",
        icon: HandCoins,
        label: "Pagar capital pendiente",
        className: "text-primary",
        onClick: () => ctx.run({ type: "contribution", partnerId: item.id, amount: item.partner_pending_capital }),
        visible: num(item.partner_pending_capital) > 0,
    },
    {
        action: "pay",
        icon: Wallet,
        label: "Registrar aporte",
        onClick: () => ctx.run({ type: "contribution", partnerId: item.id }),
    },
    {
        action: "detail",
        icon: LogOut,
        label: "Registrar retiro",
        onClick: () => ctx.run({ type: "withdrawal", partnerId: item.id }),
    },
    {
        action: "pay",
        icon: Banknote,
        label: "Pagar dividendos",
        className: "text-primary",
        onClick: () => ctx.run({ type: "dividend", partnerId: item.id }),
        visible: num(item.partner_dividends_payable_balance) > 0,
    },
    {
        action: "detail",
        icon: ArrowRightLeft,
        label: "Distribuir utilidades retenidas",
        className: "text-primary/70",
        onClick: () => ctx.run({ type: "mobilize", partnerId: item.id }),
        visible: num(item.partner_earnings_balance) > 0,
    },
    {
        action: "archive",
        icon: UserMinus,
        label: "Dar de baja",
        className: "text-destructive",
        onClick: () => ctx.run({ type: "demote", partnerId: item.id }),
        visible: demoteBlockedReason(item) === null,
    },
])
