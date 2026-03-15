"use client"

// POS Context
// Centralized state management for the POS system

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react'
import type { Product, CartItem, Category, UoM, POSSession, BOMCache, ComponentCache, BOM } from '@/types/pos'
import * as CartUtils from '@/lib/pos/cart-utils'
import api from '@/lib/api'

export interface WizardState {
    step: number
    dteData?: any
    paymentData?: any
    deliveryData?: any
    approvalTaskId?: number | null
    isWaitingApproval?: boolean
    isApproved?: boolean
    isLoading?: boolean
    isQuickSale?: boolean
}

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
    totalDiscountAmount: number
    setTotalDiscountAmount: (amount: number) => void

    // Draft & Wizard State
    currentDraftId: number | null
    setCurrentDraftId: (id: number | null) => void
    wizardState: WizardState | null
    setWizardState: (state: WizardState | null) => void

    // Caches
    bomCache: BOMCache
    componentCache: ComponentCache
    updateBomCache: (productId: number, bom: BOM) => void
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
    defaultCustomerId: number | null
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
    const [defaultCustomerId, setDefaultCustomerId] = useState<number | null>(null)
    const [totalDiscountAmount, setTotalDiscountAmount] = useState<number>(0)

    // Draft & Wizard State
    const [currentDraftId, setCurrentDraftId] = useState<number | null>(null)
    const [wizardState, setWizardState] = useState<WizardState | null>(null)

    // Fetch default customer on mount
    useEffect(() => {
        const fetchDefaultCustomer = async () => {
            try {
                const response = await api.get('/contacts/?is_default_customer=true')
                const results = response.data.results || response.data
                const defaultCustomer = results.find((c: { id: number; is_default_customer: boolean }) => c.is_default_customer)
                if (defaultCustomer) {
                    setDefaultCustomerId(defaultCustomer.id)
                    // Only set as selected if none is already selected (prevents overwriting draft loads)
                    setSelectedCustomerId(prev => prev ? prev : defaultCustomer.id)
                }
            } catch (error) {
                console.error("Error fetching default customer:", error)
            }
        }
        fetchDefaultCustomer()
    }, [])

    // Reset customer to default when session changes or initializes
    useEffect(() => {
        if (currentSession?.id && defaultCustomerId && !selectedCustomerId) {
            setSelectedCustomerId(defaultCustomerId)
        }
    }, [currentSession, defaultCustomerId, selectedCustomerId])

    // Reset draft state when session changes - Adjust state during render pattern
    const [handledSessionId, setHandledSessionId] = useState<number | null>(null);
    if (currentSession?.id && currentSession.id !== handledSessionId) {
        setHandledSessionId(currentSession.id);
        setCurrentDraftId(null);
        setWizardState(null);
    }

    // Caches
    const [bomCache, setBomCache] = useState<BOMCache>({})
    const [componentCache, setComponentCache] = useState<ComponentCache>({})

    // UI State
    const [loading, setLoading] = useState(false)

    // Cache updaters
    const updateBomCache = useCallback((productId: number, bom: BOM) => {
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
        if (defaultCustomerId) {
            setSelectedCustomerId(defaultCustomerId)
        }
    }, [defaultCustomerId])

    // Computed values
    const totals = CartUtils.calculateCartTotals(items, totalDiscountAmount)

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
        totalDiscountAmount,
        setTotalDiscountAmount,

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
        setLoading,
        defaultCustomerId
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
