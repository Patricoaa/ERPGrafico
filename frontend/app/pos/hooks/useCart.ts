// useCart Hook
// Manages cart operations with stock validation and pricing

import { useCallback } from 'react'
import { usePOS } from '../contexts/POSContext'
import type { Product, CartItem } from '@/types/pos'
import { toast } from 'sonner'
import * as CartUtils from '@/lib/pos/cart-utils'
import * as Validation from '@/lib/pos/validation'
import * as StockCalculator from '@/lib/pos/stock-calculator'
import * as BOMResolver from '@/lib/pos/bom-resolver'
import { PricingUtils } from '@/lib/pricing'
import api from '@/lib/api'

export function useCart() {
    const {
        items,
        setItems,
        addItem,
        updateItem,
        removeItem,
        clearCart,
        totals,
        products,
        uoms,
        bomCache,
        componentCache,
        updateBomCache,
        updateComponentCache
    } = usePOS()

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

    // Validate stock
    const validateStock = useCallback(async (projectedItems: CartItem[]) => {
        return StockCalculator.validateStock(
            projectedItems,
            products,
            calculateConsumption,
            fetchComponentData
        )
    }, [products, calculateConsumption, fetchComponentData])

    // Fetch effective price for a product
    const fetchEffectivePrice = useCallback(async (
        product: Product | CartItem,
        quantity: number,
        uomId: number
    ): Promise<{ net: number, gross: number }> => {
        try {
            const params = new URLSearchParams({
                product_id: product.id.toString(),
                quantity: quantity.toString(),
                uom_id: uomId.toString()
            })

            const res = await api.get(`/sales/pricing/effective-sale-price/?${params.toString()}`)
            return {
                net: parseFloat(res.data.price_net),
                gross: parseFloat(res.data.price_gross)
            }
        } catch (error) {
            console.error("Error fetching price:", error)
            return {
                net: parseFloat(product.sale_price || "0"),
                gross: parseFloat(product.sale_price_gross || "0")
            }
        }
    }, [])

    // Add product to cart
    const addProductToCart = useCallback(async (product: Product, manufacturingData?: any) => {
        // Check if can add
        const canAdd = CartUtils.canAddToCart(product)
        if (!canAdd.canAdd) {
            toast.error(canAdd.reason || "No se puede agregar el producto")
            return
        }

        const isManufacturable = product.product_type === 'MANUFACTURABLE' || product.requires_advanced_manufacturing

        // Pre-fetch BOM if manufacturable
        if (isManufacturable && product.has_bom) {
            await fetchBOM(product.id)
        }

        // Check if already exists in cart (only for non-manufacturable)
        const existing = !isManufacturable ? items.find(i => i.id === product.id) : null

        let projectedItems = [...items]
        let newQty = 1

        if (existing) {
            newQty = existing.qty + 1
            projectedItems = items.map(i =>
                i.cartItemId === existing.cartItemId
                    ? { ...i, qty: newQty }
                    : i
            )
        } else {
            const tempItem: any = { ...product, qty: 1, cartItemId: 'temp' }
            projectedItems.push(tempItem)
        }

        // Validate stock
        const check = await validateStock(projectedItems)
        if (!check.valid) {
            toast.error(check.error)
            return
        }

        // Fetch prices
        const defaultUom = product.uom || 0
        const defaultUomName = product.uom_name || uoms.find(u => u.id === defaultUom)?.name
        const prices = await fetchEffectivePrice(product, newQty, defaultUom)

        if (existing) {
            // Update existing item - Preserve discounts
            const updated = CartUtils.updateCartItemQuantity(
                existing,
                newQty,
                prices.net,
                prices.gross,
                existing.discount_percentage,
                existing.discount_amount
            )
            updateItem(existing.cartItemId, updated)
            toast.success(`Cantidad actualizada: ${product.name}`)
        } else {
            // Add new item - Start with 0 discount
            const newItem = CartUtils.createCartItem(
                product,
                1,
                defaultUom,
                defaultUomName,
                prices.net,
                prices.gross,
                0, // discountPercentage
                0, // discountAmount
                manufacturingData
            )
            addItem(newItem)
            toast.success(`Agregado al carrito: ${product.name}`)
        }
    }, [items, fetchBOM, validateStock, fetchEffectivePrice, addItem, updateItem, uoms])

    // Update quantity
    const updateQuantity = useCallback(async (cartItemId: string, qty: number | string) => {
        const item = items.find(i => i.cartItemId === cartItemId)
        if (!item) return

        const newQty = Validation.validateQuantity(qty)

        // Project the change
        const projectedItems = items.map(i =>
            i.cartItemId === cartItemId ? { ...i, qty: newQty } : i
        )

        // Validate stock
        const check = await validateStock(projectedItems)
        if (!check.valid) {
            toast.error(check.error)
            return
        }

        // Fetch new prices
        const prices = await fetchEffectivePrice(item, newQty, item.uom || item.id)

        // Update - Preserve discounts
        const updated = CartUtils.updateCartItemQuantity(
            item,
            newQty,
            prices.net,
            prices.gross,
            item.discount_percentage,
            item.discount_amount
        )
        updateItem(cartItemId, updated)
    }, [items, validateStock, fetchEffectivePrice, updateItem])

    // Remove from cart
    const removeFromCart = useCallback((cartItemId: string) => {
        const item = items.find(i => i.cartItemId === cartItemId)
        removeItem(cartItemId)
        if (item) {
            toast.success(`Eliminado: ${item.name}`)
        }
    }, [items, removeItem])

    // Validate checkout ready
    const canCheckout = useCallback(() => {
        return Validation.validateCheckoutReady(items, products)
    }, [items, products])

    return {
        items,
        totals,
        addProductToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        canCheckout,
        validateStock,
        fetchEffectivePrice
    }
}
