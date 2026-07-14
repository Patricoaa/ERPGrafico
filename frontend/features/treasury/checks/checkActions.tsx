import { createEntityActions } from '@/components/shared'
import type { Check } from './types'

export interface CheckActionsCtx {
    isIssued: boolean
    canDo: (action: string, check: Check) => boolean
    onDeposit: (check: Check) => void
    onClear: (id: number) => void
    onBounce: (id: number) => void
    onMarkCashed: (id: number) => void
    onVoid: (id: number) => void
    onViewDetail: (id: number) => void
}

export const checkActions = createEntityActions<
    Check,
    CheckActionsCtx
>((item, ctx) => [
    { action: "detail", label: "Ver detalle", onClick: () => ctx.onViewDetail(item.id) },
    { action: "pay", label: "Depositar", onClick: () => ctx.onDeposit(item), visible: !ctx.isIssued && ctx.canDo('deposit', item) },
    { action: "post", label: "Marcar cobrado", onClick: () => ctx.onClear(item.id), visible: !ctx.isIssued && ctx.canDo('clear', item) },
    { action: "delete", label: "Protestar", onClick: () => ctx.onBounce(item.id), visible: !ctx.isIssued && ctx.canDo('bounce', item) },
    { action: "post", label: "Marcar cobrado por banco", onClick: () => ctx.onMarkCashed(item.id), visible: ctx.isIssued && ctx.canDo('mark_cashed', item) },
    { action: "annul", onClick: () => ctx.onVoid(item.id), visible: ctx.canDo('void', item) },
])
