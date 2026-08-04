import { createEntityActions } from '@/components/shared'
import { ShieldAlert } from 'lucide-react'
import type { AccountingPeriod, FiscalYear } from '../../types'

export interface FiscalYearRow {
    year: number
    periods: AccountingPeriod[]
    fiscalYear?: FiscalYear
}

export interface FiscalYearActionsCtx {
    onExecuteClosing: (year: number) => void
    onReopen: (year: number) => void
}

export const fiscalYearActions = createEntityActions<FiscalYearRow, FiscalYearActionsCtx>((row, ctx) => {
    const status = row.fiscalYear?.status || 'OPEN'
    const isClosed = status === 'CLOSED'
    return [
        {
            action: "post",
            icon: ShieldAlert,
            label: "Ejecutar Cierre",
            onClick: () => ctx.onExecuteClosing(row.year),
            disabled: row.periods.length === 0 || row.periods.some(p => p.status !== 'CLOSED'),
            visible: !isClosed,
        },
        {
            action: "reopen",
            label: "Reabrir Ejercicio",
            className: "text-warning",
            onClick: () => ctx.onReopen(row.year),
            visible: isClosed,
        },
    ]
})
