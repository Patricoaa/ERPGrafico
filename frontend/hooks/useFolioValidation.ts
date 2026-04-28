"use client"

import { useState, useRef, useCallback, useEffect } from 'react'
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

interface FolioValidationOptions {
    excludeId?: number
    contactId?: number
    isPurchase?: boolean
}

export function useFolioValidation() {
    const [isValidating, setIsValidating] = useState(false)
    const [validationResult, setValidationResult] = useState<FolioValidationResult | null>(null)

    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const reqIdRef = useRef(0)

    useEffect(() => () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }, [])

    const validateFolioImmediate = useCallback(async (
        number: string,
        dteType: string,
        options: FolioValidationOptions = {}
    ) => {
        if (!number || number.trim() === '' || number === 'Draft') {
            setValidationResult(null)
            return
        }

        const myReqId = ++reqIdRef.current
        setIsValidating(true)
        try {
            const params: Record<string, unknown> = {
                number,
                dte_type: dteType,
                is_purchase: options.isPurchase ? 'true' : 'false'
            }
            if (options.excludeId) params.exclude_id = options.excludeId
            if (options.contactId) params.contact_id = options.contactId

            const response = await api.get('/billing/invoices/check_folio/', { params })
            if (myReqId !== reqIdRef.current) return
            setValidationResult(response.data)
        } catch (error) {
            if (myReqId !== reqIdRef.current) return
            console.error('Error validating folio:', error)
            setValidationResult({
                is_unique: false,
                message: 'Error al validar el folio. Por favor, intente nuevamente.'
            })
        } finally {
            if (myReqId === reqIdRef.current) {
                setIsValidating(false)
            }
        }
    }, [])

    const validateFolio = useCallback((
        number: string,
        dteType: string,
        options: FolioValidationOptions = {}
    ) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            validateFolioImmediate(number, dteType, options)
        }, 500)
    }, [validateFolioImmediate])

    const clearValidation = useCallback(() => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        reqIdRef.current++
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
