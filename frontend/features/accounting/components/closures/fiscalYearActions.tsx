import { DataCell, createEntityActions } from '@/components/shared'
import { ShieldAlert, LockOpen, PlayCircle } from 'lucide-react'
import type { AccountingPeriod, FiscalYear } from '../../types'

export interface FiscalYearRow {
    year: number
    periods: AccountingPeriod[]
    fiscalYear?: FiscalYear
}

export interface FiscalYearActionsCtx {
    onExecuteClosing: (year: number) => void
    onReopen: (year: number) => void
    onGenerateOpening: (year: number) => void
}

export const fiscalYearActions = createEntityActions<FiscalYearRow, FiscalYearActionsCtx>((row, ctx) => {
    const status = row.fiscalYear?.status || 'OPEN'
    const isClosed = status === 'CLOSED'
    return (
        <>
            {!isClosed ? (
                <DataCell.Action
                    icon={ShieldAlert}
                    title="Ejecutar Cierre"
                    onClick={() => ctx.onExecuteClosing(row.year)}
                    disabled={row.periods.length === 0 || row.periods.some(p => p.status !== 'CLOSED')}
                />
            ) : (
                <>
                    <DataCell.Action
                        icon={LockOpen}
                        title="Reabrir Ejercicio"
                        className="text-warning"
                        onClick={() => ctx.onReopen(row.year)}
                    />
                    <DataCell.Action
                        icon={PlayCircle}
                        title="Generar Asiento Apertura"
                        className="text-success"
                        onClick={() => ctx.onGenerateOpening(row.year)}
                    />
                </>
            )}
        </>
    )
})
