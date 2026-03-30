// useStockValidation Hook
// Real-time stock limit calculation and validation

import { useState, useEffect, useCallback } from 'react'
import { usePOS } from '../contexts/POSContext'
import type { StockLimits, Product, CartItem } from '@/types/pos'
import * as StockCalculator from '@/lib/pos/stock-calculator'
import * as BOMResolver from '@/lib/pos/bom-resolver'

export function useStockValidation() {
    const {
        items,
        products,
        uoms,
        bomCache,
        componentCache,
        updateBomCache,
        updateComponentCache
    } = usePOS()

    const [limits, setLimits] = useState<StockLimits>({})
    const [isCalculating, setIsCalculating] = useState(false)

    // Fetch BOM wrapper
    const fetchBOM = useCallback(async (productId: number) => {
        return BOMResolver.fetchBOM(productId, products, bomCache, updateBomCache)
    }, [products, bomCache, updateBomCache])

    // Fetch component data wrapper
    const fetchComponentData = useCallback(async (componentId: number) => {
        return BOMResolver.fetchComponentData(componentId, products, componentCache, updateComponentCache)
    }, [products, componentCache, updateComponentCache])

    // Calculate consumption wrapper
    const calculateConsumption = useCallback(async (cartItems: CartItem[], ignoreItemId?: string) => {
        return StockCalculator.calculateConsumption(
            cartItems,
            products,
            uoms,
            bomCache,
            fetchBOM,
            fetchComponentData,
            ignoreItemId
        )
    }, [products, uoms, bomCache, fetchBOM, fetchComponentData])

    // Calculate max quantity wrapper
    const calculateMaxQty = useCallback(async (
        product: Product | CartItem,
        currentQty: number = 0,
        cartItemId?: string
    ) => {
        return StockCalculator.calculateMaxQty(
            product,
            items,
            products,
            uoms,
            bomCache,
            fetchComponentData,
            calculateConsumption,
            currentQty,
            cartItemId
        )
    }, [items, products, uoms, bomCache, fetchComponentData, calculateConsumption])

    // Update limits for all items and products
    const updateLimits = useCallback(async () => {
        setIsCalculating(true)

        try {
            const newLimits: StockLimits = {}

            // Calculate limits for cart items
            for (const item of items) {
                const max = await calculateMaxQty(item, item.qty, item.cartItemId)
                newLimits[`cart_${item.cartItemId}`] = max
            }

            // Calculate limits for filtered products (optional, for display)
            // This can be heavy, so you might want to do it on-demand instead

            setLimits(newLimits)
        } catch (error) {
            console.error("Error calculating limits:", error)
        } finally {
            setIsCalculating(false)
        }
    }, [items, calculateMaxQty])

    // Update limits when cart changes (debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            updateLimits()
        }, 300)

        return () => clearTimeout(timer)
    }, [items, bomCache, componentCache])

    // Get limit for a specific item
    const getLimit = useCallback((cartItemId: string): number | undefined => {
        return limits[`cart_${cartItemId}`]
    }, [limits])

    // Get limit for a product
    const getProductLimit = useCallback(async (product: Product): Promise<number> => {
        return calculateMaxQty(product, 0)
    }, [calculateMaxQty])

    return {
        limits,
        isCalculating,
        updateLimits,
        getLimit,
        getProductLimit,
        calculateMaxQty
    }
}
