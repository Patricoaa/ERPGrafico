"use client"

import { useState, useMemo, useCallback } from 'react'
import { validateTaxPeriod } from '@/lib/actions/tax-actions'
import { validateAccountingPeriod } from '@/lib/actions/accounting-actions'

export function usePeriodValidation() {
    const [isValidating, setIsValidating] = useState(false)
    const [isClosed, setIsClosed] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    // Debounce helper
    const debounce = <T extends (...args: any[]) => any>(
        func: T,
        wait: number
    ): ((...args: Parameters<T>) => void) => {
        let timeout: NodeJS.Timeout | null = null

        return (...args: Parameters<T>) => {
            if (timeout) clearTimeout(timeout)
            timeout = setTimeout(() => func(...args), wait)
        }
    }

    const validatePeriodImmediate = async (date: string, type: 'tax' | 'accounting' | 'both' = 'tax') => {
        if (!date) {
            setIsClosed(false)
            setMessage(null)
            return
        }

        setIsValidating(true)
        try {
            let taxClosed = false
            let accountingClosed = false
            
            if (type === 'tax' || type === 'both') {
                const result = await validateTaxPeriod(date)
                taxClosed = result.is_closed
            }

            if (type === 'accounting' || type === 'both') {
                const result = await validateAccountingPeriod(date)
                accountingClosed = result.is_closed
            }

            const closed = taxClosed || accountingClosed
            setIsClosed(closed)
            
            if (closed) {
                if (taxClosed && accountingClosed) {
                    setMessage("Los periodos tributario y contable para esta fecha están cerrados.")
                } else if (taxClosed) {
                    setMessage("El periodo tributario (F29) para esta fecha está cerrado.")
                } else {
                    setMessage("El periodo contable para esta fecha está cerrado.")
                }
            } else {
                setMessage(null)
            }
        } catch (error) {
            console.error('Error validating period:', error)
            // We don't block on network error to avoid stuck UI, but we log it
            setIsClosed(false)
            setMessage(null)
        } finally {
            setIsValidating(false)
        }
    }

    // Memoized debounced version
    const validatePeriod = useMemo(
        () => debounce(validatePeriodImmediate, 500),
        []
    )

    const clearPeriodValidation = useCallback(() => {
        setIsClosed(false)
        setMessage(null)
        setIsValidating(false)
    }, [])

    return {
        validatePeriod,
        validatePeriodImmediate,
        clearPeriodValidation,
        isValidating,
        isClosed,
        message
    }
}
