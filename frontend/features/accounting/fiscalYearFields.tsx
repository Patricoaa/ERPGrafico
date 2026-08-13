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
    },
    periods_summary: {
        key: 'periods_summary',
        type: 'secondary',
        label: 'Periodos',
        get: (h) => `F29: ${h.taxPeriods.length} · Contable: ${h.periods.length}`,
    },
})
