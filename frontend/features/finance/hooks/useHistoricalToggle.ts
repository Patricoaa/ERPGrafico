'use client'

import { useState, useMemo } from 'react'
import { useFiscalYears } from '@/features/accounting'

export function useHistoricalToggle(selectedYear?: number) {
    const { data: fiscalYears } = useFiscalYears()

    const closedYear = useMemo(() => {
        if (!selectedYear || !fiscalYears?.length) return null
        return fiscalYears.find(fy => fy.year === selectedYear && fy.status === 'CLOSED') ?? null
    }, [fiscalYears, selectedYear])

    const [isHistorical, setIsHistorical] = useState(true)

    const fiscalYearId = isHistorical && closedYear ? closedYear.id : undefined

    const toggle = () => setIsHistorical(prev => !prev)

    return {
        isHistorical,
        fiscalYearId,
        toggle,
        closedYear,
        hasSnapshot: !!closedYear,
    }
}
