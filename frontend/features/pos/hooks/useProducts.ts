// useProducts Hook
// Manages product data, search, filtering, and fetching

import { useState, useEffect, useMemo, useCallback } from 'react'
import { usePOS } from '../contexts/POSProvider'
import { posApi } from '../api/posApi'
import type { Product, StockLimits, Category } from '../types'
import { toast } from 'sonner'
import { useRealtime, useEntitySubscription } from '@/features/realtime'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateCrossFeature } from '@/lib/invalidation'
import { inventoryApi } from '@/features/inventory'
import { POS_KEYS } from './queryKeys'

const EMPTY_ARRAY: Product[] = []

export function useProducts() {
    const queryClient = useQueryClient()
    const {
        setProducts: setGlobalProducts,
        setLoading
    } = usePOS()
    const { markLocalMutation } = useRealtime()

    useEntitySubscription('inventory.product', [
        POS_KEYS.products.all,
    ])

    useEntitySubscription('inventory.productcategory', [
        POS_KEYS.categories.all,
    ])

    useEntitySubscription('inventory.uom', [
        POS_KEYS.uoms.all,
    ])

    const [searchTerm, setSearchTerm] = useState("")
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [limits, setLimits] = useState<StockLimits>({})

    // 1. Fetch Products with React Query (Shared Cache)
    const { data: products = EMPTY_ARRAY, isLoading: loadingProducts } = useQuery({
        queryKey: POS_KEYS.products.list({ is_active: true, can_be_sold: true }),
        queryFn: async () => {
            const page = await inventoryApi.getProducts({
                is_active: true,
                can_be_sold: true,
                page_size: 2000, // Ensure we get all sellable items in one go for instant search
                fields: 'id,name,sale_price,sale_price_gross,image,uom_name,internal_code,barcode,product_type,track_inventory,requires_advanced_manufacturing,category,uom,available_uoms,is_favorite,has_bom,mfg_auto_finalize,mfg_enable_prepress,mfg_enable_press,mfg_enable_postpress,qty_available,manufacturable_quantity'
            })
            return (page.results ?? []) as unknown as Product[]
        },
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
            const data = await inventoryApi.getCategories()
            return (Array.isArray(data) ? data : ((data as Record<string, unknown>).results ?? [])) as unknown as Category[]
        },
        staleTime: 1000 * 60 * 60,
    })

    // 3. Fetch UoMs
    const { data: uoms = [], isLoading: loadingUoms } = useQuery({
        queryKey: ['uoms'],
        queryFn: async () => {
            const data = await posApi.getUoms({ is_active: true, page_size: 500 })
            return Array.isArray(data) ? data : ((data as { results?: unknown[] })?.results ?? [])
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

    // Filtered products based on search and category
    const filteredProducts = useMemo(() => {
        let filtered = [...products]

        // 1. Sort by favorite status first (Frontend fallback for optimistic updates)
        filtered.sort((a, b) => {
            const aFav = a.is_favorite
            const bFav = b.is_favorite
            if (aFav && !bFav) return -1
            if (!aFav && bFav) return 1
            return 0
        })

        // 2. Filter by category
        if (selectedCategoryId !== null) {
            filtered = filtered.filter(p => {
                const pCat = p.category
                const catId = typeof pCat === 'object' ? pCat?.id : pCat
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
            await invalidateCrossFeature(queryClient, [POS_KEYS.products.all])
            if (!silent) {
                toast.success("Productos actualizados")
            }
        } catch {
            if (!silent) {
                toast.error("Error al actualizar productos")
            }
        } finally {
            if (!silent) setLoading(false)
        }
    }, [queryClient, setLoading])

    const toggleFavoriteMutation = useMutation({
        mutationFn: posApi.toggleFavorite,
        onSuccess: (data) => {
            markLocalMutation()
            const isFavorite = (data as Record<string, unknown>).is_favorite as boolean
            
            invalidateCrossFeature(queryClient, [POS_KEYS.products.all])
            
            toast.success(isFavorite ? "Añadido a favoritos" : "Eliminado de favoritos")
        },
        onError: (error: Error) => {
            console.error("Error toggling favorite:", error)
            toast.error("Error al actualizar favorito")
        }
    })
    
    const toggleFavorite = toggleFavoriteMutation.mutateAsync

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
