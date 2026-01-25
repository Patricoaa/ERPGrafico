"use client"

import { useState } from 'react'
import api from '@/lib/api'

export interface LineItem {
    product_id: number
    quantity: number
    uom_id?: number
}

export interface StockValidationDetail {
    product_id: number
    product_name: string
    requested_qty: number
    available_qty?: number
    manufacturable_qty?: number
    is_available: boolean
    product_type: string
    missing_components: Array<{
        component_id: number
        component_name: string
        required_qty: number
        available_qty: number
        missing_qty: number
    }>
}

export interface StockValidationResult {
    available: boolean
    details: StockValidationDetail[]
}

export function useStockValidation() {
    const [isValidating, setIsValidating] = useState(false)

    const checkAvailability = async (lines: LineItem[]): Promise<StockValidationResult> => {
        setIsValidating(true)
        try {
            const response = await api.post('/inventory/products/check_availability/', { lines })
            return response.data
        } catch (error) {
            console.error('Error checking stock availability:', error)
            throw error
        } finally {
            setIsValidating(false)
        }
    }

    const validateLine = (product: any, requestedQty: number): boolean => {
        // Quick local validation before calling backend
        if (!product) return false

        if (product.product_type === 'STORABLE') {
            return requestedQty <= (product.qty_available || 0)
        }

        if (product.product_type === 'MANUFACTURABLE' && product.has_bom) {
            return requestedQty <= (product.manufacturable_quantity || 0)
        }

        // SERVICE, CONSUMABLE, or MANUFACTURABLE without BOM (express) - always available
        return true
    }

    const getStockMessage = (product: any, requestedQty: number): string | null => {
        if (!product) return null

        if (product.product_type === 'STORABLE') {
            const available = product.qty_available || 0
            if (requestedQty > available) {
                return `Stock insuficiente: Solo hay ${available} unidades disponibles`
            }
        }

        if (product.product_type === 'MANUFACTURABLE' && product.has_bom) {
            const canMake = product.manufacturable_quantity || 0
            if (requestedQty > canMake) {
                return `No se puede fabricar: Solo se pueden fabricar ${canMake} unidades con el stock actual de componentes`
            }
        }

        return null
    }

    return {
        checkAvailability,
        validateLine,
        getStockMessage,
        isValidating
    }
}
