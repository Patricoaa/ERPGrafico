// useProducts Hook
// Manages product data, search, filtering, and fetching

import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePOS } from '../contexts/POSContext'
import api from '@/lib/api'
import type { Product, StockLimits } from '@/types/pos'
import { toast } from 'sonner'
import * as BOMResolver from '@/lib/pos/bom-resolver'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '@/features/inventory/api/inventoryApi'

const EMPTY_ARRAY: Product[] = []

export function useProducts() {
    const queryClient = useQueryClient()
    const {
        setProducts: setGlobalProducts,
        setCategories: setGlobalCategories,
        setUoms: setGlobalUoms,
        currentSession,
        currentDraftId,
        updateBomCache,
        updateComponentCache,
        setLoading
    } = usePOS()

    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [limits, setLimits] = useState<StockLimits>({})

    // 1. Fetch Products with React Query (Shared Cache)
    const { data: products = EMPTY_ARRAY, isLoading: loadingProducts } = useQuery({
        queryKey: ['products', { active: true, can_be_sold: true }],
        queryFn: () => inventoryApi.getProducts({ 
            active: true, 
            can_be_sold: true,
            fields: 'id,name,sale_price,sale_price_gross,image,uom_name,internal_code,barcode,product_type,track_inventory,requires_advanced_manufacturing,category,uom,available_uoms,is_favorite'
        }),
        staleTime: 1000 * 60 * 5, 
    })

    // Sync global state if needed (though we should ideally use React Query data directly)
    useEffect(() => {
        setGlobalProducts(products)
    }, [products, setGlobalProducts])

    // 2. Fetch Categories
    const { data: categories = [], isLoading: loadingCategories } = useQuery({
        queryKey: ['categories'],
        queryFn: async () => {
            const res = await api.get('/inventory/categories/?page_size=9999')
            return res.data.results || res.data
        },
        staleTime: 1000 * 60 * 60,
    })

    // 3. Fetch UoMs
    const { data: uoms = [], isLoading: loadingUoms } = useQuery({
        queryKey: ['uoms'],
        queryFn: async () => {
            const res = await api.get('/inventory/uoms/?page_size=9999')
            return res.data.results || res.data
        },
        staleTime: 1000 * 60 * 60,
    })

    // Coordinate global loading state
    useEffect(() => {
        if (!loadingProducts && !loadingCategories && !loadingUoms) {
            // Add a small delay to ensure smooth transition transition and wait for caches
            const timer = setTimeout(() => setLoading(false), 300)
            return () => clearTimeout(timer)
        }
    }, [loadingProducts, loadingCategories, loadingUoms, setLoading])

    // Setup caches when products load (only for products that already have BOM data if any)
    useEffect(() => {
        if (products.length > 0) {
            const { bomCache: newBomCache, componentCache: newComponentCache } =
                BOMResolver.initializeCachesFromProducts(products)

            Object.entries(newBomCache).forEach(([productId, bom]) => {
                updateBomCache(parseInt(productId), bom)
            })

            Object.entries(newComponentCache).forEach(([componentId, data]) => {
                updateComponentCache(parseInt(componentId), data)
            })
        }
    }, [products, updateBomCache, updateComponentCache])


    // Filtered products based on search and category
    const filteredProducts = useMemo(() => {
        let filtered = [...products]

        // 1. Sort by favorite status first (Frontend fallback for optimistic updates)
        filtered.sort((a, b) => {
            if (a.is_favorite && !b.is_favorite) return -1
            if (!a.is_favorite && b.is_favorite) return 1
            return 0
        })

        // 2. Filter by category
        if (selectedCategoryId !== null) {
            filtered = filtered.filter(p => {
                const catId = typeof p.category === 'object' ? p.category?.id : p.category
                return catId === selectedCategoryId
            })
        }

        // 3. Filter by search term
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase()
            filtered = filtered.filter(p =>
                (p.name && p.name.toLowerCase().includes(term)) ||
                (p.code && p.code.toLowerCase().includes(term)) ||
                (p.internal_code && p.internal_code.toLowerCase().includes(term))
            )
        }

        return filtered
    }, [products, searchTerm, selectedCategoryId])

    const refreshProducts = useCallback(async (silent = false) => {
        if (!silent) setLoading(true)
        try {
            await queryClient.invalidateQueries({ queryKey: ['products'] })
            if (!silent) {
                toast.success("Productos actualizados")
            }
        } catch (error) {
            if (!silent) {
                toast.error("Error al actualizar productos")
            }
        } finally {
            if (!silent) setLoading(false)
        }
    }, [queryClient, setLoading])

    const toggleFavorite = useCallback(async (productId: number) => {
        try {
            const res = await api.post(`/inventory/products/${productId}/toggle_favorite/`)
            const isFavorite = res.data.is_favorite

            // Update cache directly for immediate UI response
            queryClient.setQueryData(['products', { active: true, can_be_sold: true }], (old: Product[] | undefined) => {
                if (!old) return old
                return old.map((p: Product) => p.id === productId ? { ...p, is_favorite: isFavorite } : p)
            })

            toast.success(isFavorite ? "Añadido a favoritos" : "Eliminado de favoritos")
        } catch (error) {
            console.error("Error toggling favorite:", error)
            toast.error("Error al actualizar favorito")
        }
    }, [queryClient])

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
        refreshProducts,
        toggleFavorite
    }
}
