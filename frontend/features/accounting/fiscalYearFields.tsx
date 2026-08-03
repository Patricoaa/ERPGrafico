import { createEntityFields } from '@/components/shared'
import type { AccountingPeriod, FiscalYear } from './types'
import type { TaxPeriod } from '@/features/tax'

export interface GroupedFiscalYear {
    year: number
    periods: AccountingPeriod[]
    taxPeriods: TaxPeriod[]
    fiscalYear?: FiscalYear
    status?: string
}

export const fiscalYearFields = createEntityFields<GroupedFiscalYear>()({
    year: {
        key: 'year',
        type: 'text',
        label: 'Ejercicio',
        className: 'font-bold',
    },
    status: {
        key: 'status',
        type: 'status',
        label: 'Estado',
        get: (h) => {
            const s = h.fiscalYear?.status || 'OPEN'
            if (s === 'OPEN') return 'SUCCESS'
            if (s === 'CLOSING') return 'WARNING'
            if (s === 'CLOSED') return 'INFO'
            return 'GENERIC'
        },
        getLabel: (h) => {
            const s = h.fiscalYear?.status || 'OPEN'
            if (s === 'OPEN') return 'Abierto'
            if (s === 'CLOSING') return 'En Cierre'
            if (s === 'CLOSED') return 'Cerrado'
            return s
        },
    },
    periods_summary: {
        key: 'periods_summary',
        type: 'computed',
        label: 'Periodos',
        render: (h) => (
            <div className="text-muted-foreground">
                F29: {h.taxPeriods.length} · Contable: {h.periods.length}
            </div>
        ),
    },
})
