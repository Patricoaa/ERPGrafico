import { CalendarPlus, FileCheck, FileText, ShieldAlert, Undo2 } from 'lucide-react'
import { createEntityActions, type StructuredAction } from '@/components/shared'
import { monthState, yearState, type ClosureRow } from '../../utils/closureTree'

export interface ClosureActionsCtx {
    onCloseYear: (year: number) => void
    onReopenYear: (year: number) => void
    onCreatePeriod: (year: number, month: number) => void
    onClosePeriod: (id: number) => void
    onReopenPeriod: (id: number) => void
    onOpenDeclaration: (params: { id?: number; year: number; month: number }) => void
    onPayF29: (taxPeriodId: number) => void
    onCloseTaxPeriod: (taxPeriodId: number) => void
    onReopenTaxPeriod: (taxPeriodId: number) => void
    isPeriodActionLoading: boolean
    isTaxActionLoading: boolean
    isFiscalYearLoading: boolean
}

/**
 * Actions of the closures tree. Visibility and enablement are the rules of the former
 * FiscalYearCard / CombinedPeriodCard, unchanged; only their placement moved to the row menu.
 */
export function closureActionList(row: ClosureRow, ctx: ClosureActionsCtx): StructuredAction[] {
    if (row.kind === 'year') {
        const y = yearState(row)
        return [
            {
                action: 'post',
                icon: ShieldAlert,
                label: y.canClose ? 'Cerrar ejercicio' : 'Cerrar ejercicio (faltan periodos por cerrar)',
                onClick: () => ctx.onCloseYear(row.year),
                disabled: !y.canClose || ctx.isFiscalYearLoading,
                visible: !y.isClosed,
            },
            { action: 'reopen', label: 'Reabrir ejercicio', onClick: () => ctx.onReopenYear(row.year), visible: y.isClosed },
        ]
    }
    const { acct, tax } = row
    const s = monthState(row)
    const canDeclare = !tax || (!s.taxClosed && !s.hasDeclaration)
    const declarationDoc = tax?.declaration_summary?.document
    return [
        { action: 'unlock', icon: CalendarPlus, label: 'Abrir periodo contable', onClick: () => ctx.onCreatePeriod(row.year, row.month), disabled: ctx.isPeriodActionLoading, visible: !acct },
        { action: 'lock', label: 'Cerrar periodo contable', onClick: () => acct && ctx.onClosePeriod(acct.id), disabled: ctx.isPeriodActionLoading, visible: !!acct && !s.acctClosed },
        { action: 'reopen', label: 'Reabrir periodo contable', onClick: () => acct && ctx.onReopenPeriod(acct.id), disabled: ctx.isPeriodActionLoading, visible: !!acct && s.acctClosed && !s.taxFrozen },
        // Shown disabled so the reason stays visible (the former card's dimmed lock "Bloqueado por cierre F29").
        { action: 'reopen', label: 'Reabrir periodo contable (bloqueado por cierre F29)', onClick: () => undefined, disabled: true, visible: !!acct && s.acctClosed && s.taxFrozen },
        { separator: true },
        {
            action: 'post',
            icon: FileText,
            label: !acct ? 'Declarar F29 (abre el periodo contable primero)' : s.acctClosed ? 'Declarar F29 (periodo contable cerrado)' : 'Declarar F29',
            onClick: () => ctx.onOpenDeclaration({ id: tax?.id, year: row.year, month: row.month }),
            disabled: ctx.isTaxActionLoading || !acct || s.acctClosed,
            visible: canDeclare,
        },
        { action: 'pay', label: 'Pagar F29', onClick: () => tax && ctx.onPayF29(tax.id), disabled: ctx.isTaxActionLoading, visible: !!tax && !s.taxClosed && s.hasDeclaration && !s.isFullyPaid && s.requiresPayment },
        { action: 'lock', icon: FileCheck, label: 'Cerrar F29', onClick: () => tax && ctx.onCloseTaxPeriod(tax.id), disabled: ctx.isTaxActionLoading, visible: !!tax && !s.taxClosed && s.hasDeclaration && (s.isFullyPaid || !s.requiresPayment) },
        { action: 'reopen', icon: Undo2, label: 'Reabrir F29', onClick: () => tax && ctx.onReopenTaxPeriod(tax.id), disabled: ctx.isTaxActionLoading, visible: !!tax && s.taxClosed && !s.acctClosed },
        { action: 'download', label: 'Ver comprobante F29', onClick: () => declarationDoc && window.open(declarationDoc, '_blank', 'noopener,noreferrer'), visible: !!declarationDoc },
    ]
}

export const closureActions = createEntityActions<ClosureRow, ClosureActionsCtx>(closureActionList)
