import { DataCell, createEntityActions } from '@/components/shared'
import { ArrowDownToLine, CheckCheck, XCircle, Ban, Eye } from 'lucide-react'
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
>((item, ctx) => (
    <>
        <DataCell.Action icon={Eye} title="Ver detalle" onClick={() => ctx.onViewDetail(item.id)} />
        {!ctx.isIssued && ctx.canDo('deposit', item) && (
            <DataCell.Action icon={ArrowDownToLine} title="Depositar" onClick={() => ctx.onDeposit(item)} />
        )}
        {!ctx.isIssued && ctx.canDo('clear', item) && (
            <DataCell.Action icon={CheckCheck} title="Marcar cobrado" onClick={() => ctx.onClear(item.id)} />
        )}
        {!ctx.isIssued && ctx.canDo('bounce', item) && (
            <DataCell.Action icon={XCircle} title="Protestar" onClick={() => ctx.onBounce(item.id)} />
        )}
        {ctx.isIssued && ctx.canDo('mark_cashed', item) && (
            <DataCell.Action icon={CheckCheck} title="Marcar cobrado por banco" onClick={() => ctx.onMarkCashed(item.id)} />
        )}
        {ctx.canDo('void', item) && (
            <DataCell.Action icon={Ban} title="Anular" onClick={() => ctx.onVoid(item.id)} />
        )}
    </>
))
