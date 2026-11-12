import { createEntityActions, type StructuredAction } from '@/components/shared'
import { CheckCircle2, DollarSign, FileText } from 'lucide-react'
import type { TaxPeriod } from '../types'
import { deriveF29Phase, type F29Phase } from '../utils/f29Phase'

export interface TaxDeclarationActionsCtx {
    onOpenF29: (period: TaxPeriod) => void
}

const LABELS: Record<F29Phase, string> = {
    prior: 'Declarar F29',
    payment: 'Registrar pago F29',
    close: 'Cerrar F29',
    done: 'Ver F29',
}

/** One contextual primary F29 action: the wizard opens in the phase the period is in. */
export function taxDeclarationActionList(period: TaxPeriod, ctx: TaxDeclarationActionsCtx): StructuredAction[] {
    const phase = deriveF29Phase(period)
    return [
        {
            action: phase === 'payment' ? 'pay' : phase === 'close' ? 'lock' : phase === 'done' ? 'detail' : 'post',
            icon: phase === 'payment' ? DollarSign : phase === 'done' ? CheckCircle2 : FileText,
            label: LABELS[phase],
            onClick: (e) => { e.stopPropagation(); ctx.onOpenF29(period) },
        },
    ]
}

export const taxDeclarationActions = createEntityActions<TaxPeriod, TaxDeclarationActionsCtx>(taxDeclarationActionList)
