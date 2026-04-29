"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
import { validateTaxPeriod } from '@/features/tax/actions'
import { validateAccountingPeriod } from '@/features/accounting/actions'

type ValidationType = 'tax' | 'accounting' | 'both'

export function usePeriodValidation() {
    const [isValidating, setIsValidating] = useState(false)
    const [isClosed, setIsClosed] = useState(false)
    const [message, setMessage] = useState<string | null>(null)

    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const reqIdRef = useRef(0)

    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }, [])

    const validatePeriodImmediate = useCallback(async (date: string, type: ValidationType = 'tax') => {
        if (!date) {
            setIsClosed(false)
            setMessage(null)
            return
        }

        const myReqId = ++reqIdRef.current
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

            if (myReqId !== reqIdRef.current) return

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
            if (myReqId !== reqIdRef.current) return
            console.error('Error validating period:', error)
            setIsClosed(false)
            setMessage(null)
        } finally {
            if (myReqId === reqIdRef.current) {
                setIsValidating(false)
            }
        }
    }, [])

    const validatePeriod = useCallback((date: string, type: ValidationType = 'tax') => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            validatePeriodImmediate(date, type)
        }, 500)
    }, [validatePeriodImmediate])

    const clearPeriodValidation = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        reqIdRef.current++
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
