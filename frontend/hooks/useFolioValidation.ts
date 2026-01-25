"use client"

import { useState, useMemo, useCallback } from 'react'
import api from '@/lib/api'

export interface FolioValidationResult {
    is_unique: boolean
    message: string
    existing_invoice?: {
        id: number
        number: string
        date: string | null
        customer_name: string | null
        total: number
    }
}

export function useFolioValidation() {
    const [isValidating, setIsValidating] = useState(false)
    const [validationResult, setValidationResult] = useState<FolioValidationResult | null>(null)

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

    const validateFolioImmediate = async (
        number: string,
        dteType: string,
        excludeId?: number
    ) => {
        // Skip validation for empty or draft numbers
        if (!number || number.trim() === '' || number === 'Draft') {
            setValidationResult(null)
            return
        }

        setIsValidating(true)
        try {
            const params: any = { number, dte_type: dteType }
            if (excludeId) params.exclude_id = excludeId

            const response = await api.get('/billing/invoices/check_folio/', { params })
            setValidationResult(response.data)
        } catch (error) {
            console.error('Error validating folio:', error)
            setValidationResult({
                is_unique: false,
                message: 'Error al validar el folio. Por favor, intente nuevamente.'
            })
        } finally {
            setIsValidating(false)
        }
    }

    // Memoized debounced version
    const validateFolio = useMemo(
        () => debounce(validateFolioImmediate, 500),
        []
    )

    const clearValidation = useCallback(() => {
        setValidationResult(null)
        setIsValidating(false)
    }, [])

    return {
        validateFolio,
        validateFolioImmediate,
        clearValidation,
        isValidating,
        validationResult
    }
}
