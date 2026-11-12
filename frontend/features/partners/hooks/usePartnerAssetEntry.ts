'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { Product } from '@/features/inventory'
import { usePartnerAssetProduct, usePartnerAssetUoms } from './usePartnerAssets'

export interface PartnerAssetData {
    warehouseId: string
    productId: string
    quantity: string
    uomId: string
    unitCost: string
    date: string
    description: string
}

const emptyAssetData = (): PartnerAssetData => ({
    warehouseId: '',
    productId: '',
    quantity: '',
    uomId: '',
    unitCost: '0',
    date: new Date().toISOString().split('T')[0],
    description: '',
})

/**
 * Borrador de un aporte/retiro de socio en bienes. Al elegir producto siembra el costo
 * unitario y la UoM base una sola vez por producto (el usuario puede editarlos después).
 */
export function usePartnerAssetEntry() {
    const [assetData, setAssetData] = useState<PartnerAssetData>(emptyAssetData)
    const [costSeededFor, setCostSeededFor] = useState('')
    const [uomSeededFor, setUomSeededFor] = useState('')

    const productId = assetData.productId
    const productQuery = usePartnerAssetProduct(productId)
    const product = productId ? productQuery.data : undefined
    const uomsQuery = usePartnerAssetUoms(product?.uom_category)
    const uoms = product ? uomsQuery.data : undefined

    // Ajuste de estado durante el render (sin efectos): siembra costo y UoM base.
    if (!productId) {
        if (costSeededFor) setCostSeededFor('')
        if (uomSeededFor) setUomSeededFor('')
    }
    if (productId && product && costSeededFor !== productId) {
        setCostSeededFor(productId)
        setAssetData(prev => ({ ...prev, unitCost: product.cost_price?.toString() || '0' }))
    }
    if (productId && product && uoms && uomSeededFor !== productId) {
        setUomSeededFor(productId)
        const baseId = typeof product.uom === 'object' ? product.uom.id : product.uom
        const base = uoms.find(u => u.id === baseId)
        if (base) setAssetData(prev => ({ ...prev, uomId: base.id.toString() }))
    }

    useEffect(() => {
        if (productQuery.isError) toast.error('Error cargando producto')
    }, [productQuery.isError])

    const reset = () => {
        setAssetData(emptyAssetData())
        setCostSeededFor('')
        setUomSeededFor('')
    }

    return {
        assetData,
        setAssetData,
        productDetails: product ? (product as unknown as Product) : null,
        productUoMs: uoms ?? [],
        reset,
    }
}
