"use client"

// POS Context
// Centralized state management for the POS system

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import type { Product, CartItem, Category, UoM, POSSession, BOMCache, ComponentCache } from '@/types/pos'
import { toast } from 'sonner'
import * as CartUtils from '@/lib/pos/cart-utils'
import * as Validation from '@/lib/pos/validation'
import api from '@/lib/api'

interface POSContextValue {
    // Session
    currentSession: POSSession | null
    setCurrentSession: (session: POSSession | null) => void

    // Products
    products: Product[]
    setProducts: (products: Product[]) => void
    categories: Category[]
    setCategories: (categories: Category[]) => void
    uoms: UoM[]
    setUoms: (uoms: UoM[]) => void

    // Cart
    items: CartItem[]
    selectedCustomerId: number | null
    setSelectedCustomerId: (id: number | null) => void

    // Draft & Wizard State
    currentDraftId: number | null
    setCurrentDraftId: (id: number | null) => void
    wizardState: any | null
    setWizardState: (state: any | null) => void

    // Caches
    bomCache: BOMCache
    componentCache: ComponentCache
    updateBomCache: (productId: number, bom: any) => void
    updateComponentCache: (componentId: number, data: { stock: number, uom: number }) => void

    // Cart Actions
    addItem: (item: CartItem) => void
    updateItem: (cartItemId: string, updates: Partial<CartItem>) => void
    removeItem: (cartItemId: string) => void
    clearCart: () => void
    setItems: (items: CartItem[]) => void

    // Computed
    totals: {
        total_gross: number
        total_net: number
        total_tax: number
    }

    // UI State
    loading: boolean
    setLoading: (loading: boolean) => void
}

const POSContext = createContext<POSContextValue | undefined>(undefined)

export function POSProvider({ children }: { children: ReactNode }) {
    // Session State
    const [currentSession, setCurrentSession] = useState<POSSession | null>(null)

    // Product Data
    const [products, setProducts] = useState<Product[]>([])
    const [categories, setCategories] = useState<Category[]>([])
    const [uoms, setUoms] = useState<UoM[]>([])

    // Cart State
    const [items, setItems] = useState<CartItem[]>([])
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)

    // Draft & Wizard State
    const [currentDraftId, setCurrentDraftId] = useState<number | null>(null)
    const [wizardState, setWizardState] = useState<any | null>(null)

    // Fetch default customer on mount
    useEffect(() => {
        const fetchDefaultCustomer = async () => {
            try {
                const response = await api.get('/contacts/?is_default_customer=true')
                const results = response.data.results || response.data
                const defaultCustomer = results.find((c: any) => c.is_default_customer)
                if (defaultCustomer) {
                    setSelectedCustomerId(defaultCustomer.id)
                }
            } catch (error) {
                console.error("Error fetching default customer:", error)
            }
        }
        fetchDefaultCustomer()
    }, [])

    // Reset draft state when session changes
    useEffect(() => {
        if (currentSession?.id) {
            setCurrentDraftId(null)
            setWizardState(null)
        }
    }, [currentSession?.id])

    // Caches
    const [bomCache, setBomCache] = useState<BOMCache>({})
    const [componentCache, setComponentCache] = useState<ComponentCache>({})

    // UI State
    const [loading, setLoading] = useState(false)

    // Cache updaters
    const updateBomCache = useCallback((productId: number, bom: any) => {
        setBomCache(prev => ({ ...prev, [productId]: bom }))
    }, [])

    const updateComponentCache = useCallback((componentId: number, data: { stock: number, uom: number }) => {
        setComponentCache(prev => ({ ...prev, [componentId]: data }))
    }, [])

    // Cart Actions
    const addItem = useCallback((item: CartItem) => {
        setItems(prev => [...prev, item])
    }, [])

    const updateItem = useCallback((cartItemId: string, updates: Partial<CartItem>) => {
        setItems(prev => prev.map(i =>
            i.cartItemId === cartItemId ? { ...i, ...updates } : i
        ))
    }, [])

    const removeItem = useCallback((cartItemId: string) => {
        setItems(prev => prev.filter(i => i.cartItemId !== cartItemId))
    }, [])

    const clearCart = useCallback(() => {
        setItems([])
    }, [])

    // Computed values
    const totals = CartUtils.calculateCartTotals(items)

    const value: POSContextValue = {
        // Session
        currentSession,
        setCurrentSession,

        // Products
        products,
        setProducts,
        categories,
        setCategories,
        uoms,
        setUoms,

        // Cart
        items,
        selectedCustomerId,
        setSelectedCustomerId,

        // Draft & Wizard State
        currentDraftId,
        setCurrentDraftId,
        wizardState,
        setWizardState,

        // Caches
        bomCache,
        componentCache,
        updateBomCache,
        updateComponentCache,

        // Actions
        addItem,
        updateItem,
        removeItem,
        clearCart,
        setItems,

        // Computed
        totals,

        // UI
        loading,
        setLoading
    }

    return <POSContext.Provider value={value}>{children}</POSContext.Provider>
}

export function usePOS() {
    const context = useContext(POSContext)
    if (context === undefined) {
        throw new Error('usePOS must be used within a POSProvider')
    }
    return context
}
