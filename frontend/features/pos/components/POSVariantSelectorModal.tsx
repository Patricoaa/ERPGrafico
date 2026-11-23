"use client"

/**
 * @deprecated Use `VariantSelectorModal` from `@/components/selectors/ProductGridPicker` instead.
 * This component is maintained as a backward compatibility shim for POSClientView.
 * TODO(sprint-planning): Refactor POSClientView to use the shared VariantSelectorModal directly.
 */
import React, { useCallback, useMemo } from 'react'
import { VariantSelectorModal } from '@/components/selectors/ProductGridPicker'
import { isPOSProductDisabled } from '@/features/pos/utils/product-availability'
import type { Product, Variant, CartItem } from '../types'
import type { BaseProduct, ProductCategory } from '@/features/inventory'


export interface POSVariantSelectorModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    product: Product | null
    onSelect: (variant: Variant) => void
    initialVariantId?: number | null
    // The following props are maintained for backwards compatibility with the POS usage
    items: CartItem[]
    bomCache: Record<number, Record<string, unknown>>
    componentCache: Record<number, { stock: number, uom: number }>
    calculateMaxQty: (product: Variant, cartItemId?: string) => Promise<number>
    /** Categorías del catálogo, para heredar su icono cuando la variante no tiene imagen. */
    categories?: ProductCategory[]
}

export function POSVariantSelectorModal({
    open,
    onOpenChange,
    product,
    onSelect,
    calculateMaxQty,
    categories
}: POSVariantSelectorModalProps) {
    // Pass the session ID to filter active/session specific variants if needed
    const extraParams = useMemo<Record<string, string> | undefined>(() => {
        const storedSessionId = typeof window !== 'undefined' ? localStorage.getItem('shared_pos_session_id') : null
        return storedSessionId ? { pos_session_id: storedSessionId } : undefined
    }, [])

    const getVariantLimit = useCallback(async (v: BaseProduct) => {
        // Safe cast as we know in this context it's a POS variant
        return await calculateMaxQty(v as Variant)
    }, [calculateMaxQty])

    const handleSelect = useCallback((v: BaseProduct) => {
        onSelect(v as Variant)
    }, [onSelect])

    return (
        <VariantSelectorModal
            open={open}
            onOpenChange={onOpenChange}
            product={product}
            onSelect={handleSelect}
            isVariantDisabled={(v) => isPOSProductDisabled(v as Product)}
            getVariantLimit={getVariantLimit}
            extraApiParams={extraParams}
            categories={categories}
        />
    )
}
