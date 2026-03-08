// useProducts Hook
// Manages product data, search, filtering, and fetching

import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePOS } from '../contexts/POSContext'
import api from '@/lib/api'
import type { Product, StockLimits } from '@/types/pos'
import { toast } from 'sonner'
import * as BOMResolver from '@/lib/pos/bom-resolver'

export function useProducts() {
    const {
        products,
        setProducts,
        categories,
        setCategories,
        uoms,
        setUoms,
        items,
        currentSession,
        currentDraftId,
        bomCache,
        componentCache,
        updateBomCache,
        updateComponentCache,
        setLoading
    } = usePOS()

    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [limits, setLimits] = useState<StockLimits>({})

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            if (!currentSession?.id) return

            setLoading(true)
            try {
                const sessionParams = `&pos_session_id=${currentSession.id}`
                const draftParams = currentDraftId ? `&exclude_draft_id=${currentDraftId}` : ''
                const [productsRes, categoriesRes, uomsRes] = await Promise.all([
                    api.get(`/inventory/products/?is_active=true&can_be_sold=true&include_boms=true${sessionParams}${draftParams}`),
                    api.get('/inventory/categories/?page_size=9999'),
                    api.get('/inventory/uoms/?page_size=9999')
                ])

                setProducts(productsRes.data.results || productsRes.data)
                setCategories(categoriesRes.data.results || categoriesRes.data)
                setUoms(uomsRes.data.results || uomsRes.data)

                // Initialize caches from products
                const { bomCache: newBomCache, componentCache: newComponentCache } =
                    BOMResolver.initializeCachesFromProducts(productsRes.data.results || productsRes.data)

                Object.entries(newBomCache).forEach(([productId, bom]) => {
                    updateBomCache(parseInt(productId), bom)
                })

                Object.entries(newComponentCache).forEach(([componentId, data]) => {
                    updateComponentCache(parseInt(componentId), data)
                })

            } catch (error) {
                console.error("Error fetching POS data:", error)
                toast.error("Error al cargar datos del POS")
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [currentSession?.id, currentDraftId])

    // Filtered products based on search and category
    const filteredProducts = useMemo(() => {
        let filtered = products

        // Filter by category
        if (selectedCategoryId !== null) {
            filtered = filtered.filter(p => {
                const catId = typeof p.category === 'object' ? p.category?.id : p.category
                return catId === selectedCategoryId
            })
        }

        // Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(p =>
                p.name.toLowerCase().includes(term) ||
                p.code.toLowerCase().includes(term) ||
                p.internal_code?.toLowerCase().includes(term)
            )
        }

        return filtered
    }, [products, searchTerm, selectedCategoryId])

    const refreshProducts = useCallback(async (silent = false) => {
        if (!currentSession?.id) return
        setLoading(true)
        try {
            const draftParams = currentDraftId ? `&exclude_draft_id=${currentDraftId}` : ''
            const res = await api.get(`/inventory/products/?is_active=true&can_be_sold=true&include_boms=true&pos_session_id=${currentSession.id}${draftParams}`)
            setProducts(res.data.results || res.data)
            if (!silent) {
                toast.success("Productos actualizados")
            }
        } catch (error) {
            if (!silent) {
                toast.error("Error al actualizar productos")
            }
        } finally {
            setLoading(false)
        }
    }, [setLoading, setProducts, currentSession?.id, currentDraftId])

    return {
        products,
        filteredProducts,
        categories,
        uoms,
        searchTerm,
        setSearchTerm,
        selectedCategoryId,
        setSelectedCategoryId,
        limits,
        setLimits,
        refreshProducts
    }
}
