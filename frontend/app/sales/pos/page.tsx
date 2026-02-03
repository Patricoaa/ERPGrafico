"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, ShoppingCart, Search, User, Minus, Package, Info, ChevronLeft, ChevronRight, BarChart3 } from "lucide-react"
import * as LucideIcons from "lucide-react"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { toast } from "sonner"
import { formatCurrency } from "@/lib/currency"
import { PricingUtils } from "@/lib/pricing"
import { AdvancedContactSelector } from "@/components/selectors/AdvancedContactSelector"
import { SalesCheckoutWizard } from "@/components/sales/SalesCheckoutWizard"
import { SessionControl, SessionControlHandle } from "@/components/pos/SessionControl"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

import { POSVariantSelectorModal } from "@/components/pos/POSVariantSelectorModal"
import { DraftCartsList } from "@/components/pos/DraftCartsList"
import { Edit2, Save, Clock, LayoutGrid, FileText, ChevronDown } from "lucide-react"

interface Product {
    id: number
    code: string
    internal_code?: string
    name: string
    sale_price: string
    sale_price_gross: string
    current_stock?: number
    manufacturable_quantity?: number | null
    product_type?: string
    variants_count?: number
    has_variants?: boolean
    image?: string | null
    requires_advanced_manufacturing?: boolean
    is_dynamic_pricing?: boolean
    has_bom?: boolean
    category?: {
        id: number
        name: string
        icon?: string | null
    } | number
    uom?: number
    uom_name?: string
    allowed_sale_uoms?: number[]
}

interface Category {
    id: number
    name: string
    icon?: string | null
}

interface Customer {
    id: number
    name: string
}

interface CartItem extends Product {
    cartItemId: string
    qty: number
    total_net: number
    total_gross: number
    unit_price_net: number
    unit_price_gross: number
    uom?: number
    manufacturing_data?: any
    uom_name?: string
}

interface BOMLine {
    id: number
    component: number
    quantity: number
    uom: number | null
}

interface BOM {
    id: number
    product: number
    lines: BOMLine[]
    active: boolean
}

const DynamicIcon = ({ name, className }: { name: string, className?: string }) => {
    const IconComponent = (LucideIcons as any)[name] || LucideIcons.Package
    return <IconComponent className={className} />
}

export default function POSPage() {
    const [products, setProducts] = useState<Product[]>([])
    // const [customers, setCustomers] = useState<Customer[]>([]) // Removed in favor of async selector
    const [items, setItems] = useState<CartItem[]>([])
    const [searchTerm, setSearchTerm] = useState("")
    const [loading, setLoading] = useState(false)
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [draftsListOpen, setDraftsListOpen] = useState(false)
    const [categories, setCategories] = useState<Category[]>([])
    const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
    const [uoms, setUoMs] = useState<any[]>([])
    const [currentSession, setCurrentSession] = useState<any>(null)
    const [variantModalOpen, setVariantModalOpen] = useState(false)
    const [activeParentProduct, setActiveParentProduct] = useState<Product | null>(null)
    const [editingCartItem, setEditingCartItem] = useState<CartItem | null>(null)
    const categoryScrollRef = useRef<HTMLDivElement>(null)

    // Draft Cart State
    const [currentDraftId, setCurrentDraftId] = useState<number | null>(null)
    const [draftName, setDraftName] = useState("")
    const [saving, setSaving] = useState(false)
    const [lastSaved, setLastSaved] = useState<Date | null>(null)
    const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null)

    // Stock Validation State
    const [bomCache, setBomCache] = useState<Record<number, BOM>>({})
    const [componentCache, setComponentCache] = useState<Record<number, { stock: number, uom: number }>>({})

    // Live recalculation state
    const [limits, setLimits] = useState<Record<string, number>>({}) // Keyed by cartItemId or productID (prefix?)

    const sessionControlRef = useRef<SessionControlHandle>(null)



    useEffect(() => {
        // ... (fetchData implementation unchanged)
        const fetchData = async () => {
            setLoading(true)

            // Fetch Products
            try {
                const res = await api.get('/inventory/products/?can_be_sold=true&parent_template__isnull=true')
                setProducts(res.data.results || res.data)
            } catch (error) {
                console.error("Failed to fetch products", error)
                toast.error("Error al cargar productos")
                setProducts([])
            }

            // Fetch Categories
            try {
                const res = await api.get('/inventory/categories/')
                setCategories(res.data.results || res.data)
            } catch (error) {
                console.error("Failed to fetch categories", error)
                setCategories([])
            }

            // Fetch UoMs
            try {
                const res = await api.get('/inventory/uoms/')
                setUoMs(res.data.results || res.data)
            } catch (error) {
                console.error("Failed to fetch UoMs", error)
                setUoMs([])
            }



            setLoading(false)
        }
        fetchData()
    }, [])

    // ... (filteredProducts and getEffectivePrice unchanged)
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = (p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.code.toLowerCase().includes(searchTerm.toLowerCase()))

            const categoryId = typeof p.category === 'object' ? p.category?.id : p.category
            const matchesCategory = selectedCategoryId === null || categoryId === selectedCategoryId

            return matchesSearch && matchesCategory
        })
    }, [products, searchTerm, selectedCategoryId])

    const fetchEffectivePrice = async (product: any, qty: number, selectedUomId?: number) => {
        if (!product || !product.id) return { net: 0, gross: 0 }
        try {
            const params: any = { quantity: qty }
            if (selectedUomId) params.uom_id = selectedUomId

            const response = await api.get(`/inventory/products/${product.id}/effective_price/`, { params })
            return {
                net: parseFloat(response.data.price_net || "0"),
                gross: parseFloat(response.data.price_gross || response.data.price || "0")
            }
        } catch (error) {
            console.error("Error fetching price:", error)
            const net = parseFloat(product.sale_price || "0")
            const gross = parseFloat(product.sale_price_gross || "0") || PricingUtils.netToGross(net)
            return { net, gross }
        }
    }

    // --- Shared Stock Validation Logic ---

    const getConversionFactor = (fromUomId: number | undefined, toUomId: number | undefined): number => {
        if (!fromUomId || !toUomId || fromUomId === toUomId) return 1
        const fromUom = uoms.find(u => u.id === fromUomId)
        const toUom = uoms.find(u => u.id === toUomId)
        if (!fromUom || !toUom || fromUom.category !== toUom.category) return 1
        return (parseFloat(fromUom.ratio || "1") / parseFloat(toUom.ratio || "1"))
    }


    const fetchBOM = async (productId: number): Promise<BOM | null> => {
        if (bomCache[productId]) return bomCache[productId]

        try {
            const res = await api.get(`/production/boms/?product_id=${productId}&active=true`)
            const boms = res.data.results || res.data
            const activeBom = boms.find((b: BOM) => b.active)
            if (activeBom) {
                setBomCache(prev => ({ ...prev, [productId]: activeBom }))
                return activeBom
            }
        } catch (error) {
            console.error(`Error fetching BOM for product ${productId}`, error)
        }
        return null
    }

    const fetchComponentData = async (componentId: number): Promise<{ stock: number, uom: number } | null> => {
        const internalProd = products.find(p => p.id === componentId)
        if (internalProd) return { stock: internalProd.current_stock || 0, uom: internalProd.uom || 0 }

        if (componentCache[componentId]) return componentCache[componentId]

        try {
            const res = await api.get(`/inventory/products/${componentId}/`)
            const data = {
                stock: res.data.current_stock || 0,
                uom: res.data.uom || 0
            }
            setComponentCache(prev => ({ ...prev, [componentId]: data }))
            return data
        } catch (error) {
            console.error(`Error fetching data for component ${componentId}`, error)
            return null
        }
    }

    // Helper to calculate total consumption of components by a list of items
    const calculateConsumption = async (cartItems: CartItem[], ignoreItemId?: string) => {
        const consumption: Record<number, number> = {}

        for (const item of cartItems) {
            if (ignoreItemId && item.cartItemId === ignoreItemId) continue

            let itemRefUomId = (item as any).uom
            let productDef = products.find(p => p.id === item.id)
            if (productDef) itemRefUomId = productDef.uom

            const itemFactor = getConversionFactor(item.uom, itemRefUomId)
            const qtyRef = item.qty * itemFactor

            const isManufacturable = (item.product_type === 'MANUFACTURABLE' || item.requires_advanced_manufacturing)
            const hasBom = item.has_bom || (item as any).has_active_bom

            if (isManufacturable && hasBom) {
                let bom = bomCache[item.id]
                if (!bom) bom = await fetchBOM(item.id) as BOM

                if (bom && bom.lines) {
                    for (const line of bom.lines) {
                        const neededInLineUom = qtyRef * line.quantity
                        const compData = await fetchComponentData(line.component)
                        if (compData) {
                            const lineToCompFactor = getConversionFactor(line.uom || undefined, compData.uom)
                            const neededInCompRef = neededInLineUom * lineToCompFactor
                            consumption[line.component] = (consumption[line.component] || 0) + neededInCompRef
                        }
                    }
                }
            } else if (item.product_type === 'STORABLE') {
                consumption[item.id] = (consumption[item.id] || 0) + qtyRef
            }
        }
        return consumption
    }

    const calculateMaxQty = async (product: Product | CartItem, currentQty: number = 0, cartItemId?: string): Promise<number> => {
        const consumption = await calculateConsumption(items, cartItemId)

        let maxQty = Infinity

        const isManufacturable = (product.product_type === 'MANUFACTURABLE' || product.requires_advanced_manufacturing)
        const hasBom = product.has_bom || (product as any).has_active_bom

        const productDef = products.find(p => p.id === product.id)
        if (!productDef && product.product_type === 'STORABLE') return Infinity

        const itemUom = (product as any).uom
        const defUom = productDef ? productDef.uom : itemUom
        const factorToRef = getConversionFactor(itemUom, defUom)

        if (product.product_type === 'STORABLE') {
            const currentStock = (product as any).current_stock || (productDef ? productDef.current_stock : 0) || 0
            const availableRef = currentStock - (consumption[product.id] || 0)
            maxQty = availableRef / factorToRef
        } else if (isManufacturable && hasBom) {
            const bom = bomCache[product.id]
            if (!bom) return (product.manufacturable_quantity ?? Infinity)

            for (const line of bom.lines) {
                const compData = await fetchComponentData(line.component)
                if (compData) {
                    const usedByOthers = consumption[line.component] || 0
                    const remainingStock = compData.stock - usedByOthers
                    const lineToCompFactor = getConversionFactor(line.uom || undefined, compData.uom)
                    const compNeededPerProductRef = line.quantity * lineToCompFactor

                    if (compNeededPerProductRef > 0) {
                        const maxProductRefUnits = remainingStock / compNeededPerProductRef
                        const maxProductUnits = maxProductRefUnits / factorToRef
                        if (maxProductUnits < maxQty) maxQty = maxProductUnits
                    }
                }
            }
        }

        return maxQty < 0 ? 0 : Math.floor(maxQty)
    }

    const validateStock = async (projectedItems: CartItem[]): Promise<{ valid: boolean, error?: string }> => {
        const consumption = await calculateConsumption(projectedItems)

        for (const [componentIdStr, qtyNeeded] of Object.entries(consumption)) {
            const componentId = parseInt(componentIdStr)
            const data = await fetchComponentData(componentId)

            if (data && qtyNeeded > (data.stock + 0.0001)) { // Add epsilon for float errors
                const prod = products.find(p => p.id === componentId)
                let name = prod?.name
                if (!name) {
                    try {
                        const res = await api.get(`/inventory/products/${componentId}/`)
                        name = res.data.name
                    } catch (e) { name = `Componente #${componentId}` }
                }

                return {
                    valid: false,
                    error: `Stock insuficiente para ${name}. Necesario: ${parseFloat(qtyNeeded.toFixed(4))}, Disponible: ${parseFloat(data.stock.toFixed(4))}`
                }
            }
        }
        return { valid: true }
    }


    // Recalculate limits when items or stock cache changes
    useEffect(() => {
        let active = true
        const updateLimits = async () => {
            const consumption = await calculateConsumption(items)
            if (!active) return

            const newLimits: Record<string, number> = {}

            // 1. For Cart Items
            for (const item of items) {
                const max = await calculateMaxQty(item, item.qty, item.cartItemId)
                newLimits[`cart_${item.cartItemId}`] = max
            }

            // 2. For Visible Products
            for (const p of filteredProducts) {
                let maxQty = Infinity
                const productDef = products.find(prod => prod.id === p.id)
                if (!productDef && p.product_type === 'STORABLE') continue

                const itemUom = (p as any).uom
                const defUom = productDef ? productDef.uom : itemUom
                const factorToRef = getConversionFactor(itemUom, defUom)

                if (p.product_type === 'STORABLE') {
                    const availableRef = ((p as any).current_stock || 0) - (consumption[p.id] || 0)
                    maxQty = availableRef / factorToRef
                } else if ((p.product_type === 'MANUFACTURABLE' || p.requires_advanced_manufacturing) && (p.has_bom || (p as any).has_active_bom)) {
                    const bom = bomCache[p.id]
                    if (bom) {
                        for (const line of bom.lines) {
                            const compData = await fetchComponentData(line.component)
                            if (compData) {
                                const usedTotal = consumption[line.component] || 0
                                const remainingStock = compData.stock - usedTotal

                                const lineToCompFactor = getConversionFactor(line.uom || undefined, compData.uom)
                                const compNeededPerProductRef = line.quantity * lineToCompFactor

                                if (compNeededPerProductRef > 0) {
                                    const maxProductRefUnits = remainingStock / compNeededPerProductRef
                                    const maxProductUnits = maxProductRefUnits / factorToRef
                                    if (maxProductUnits < maxQty) maxQty = maxProductUnits
                                }
                            }
                        }
                    } else {
                        maxQty = p.manufacturable_quantity ?? Infinity
                    }
                }

                newLimits[`prod_${p.id}`] = maxQty < 0 ? 0 : Math.floor(maxQty)
            }

            if (active) setLimits(newLimits)
        }

        const timer = setTimeout(() => {
            updateLimits()
        }, 300)
        return () => {
            active = false
            clearTimeout(timer)
        }
    }, [items, bomCache, componentCache, products, filteredProducts])


    const addProductToCart = async (product: Product, mfgData?: any) => {
        // Pre-fetch BOM if needed for validation
        const isManufacturable = product.product_type === 'MANUFACTURABLE' || product.requires_advanced_manufacturing;
        const hasBom = product.has_bom || (product as any).has_active_bom
        if (isManufacturable && hasBom && !bomCache[product.id]) {
            await fetchBOM(product.id)
        }

        const existing = !isManufacturable ? items.find(i => i.id === product.id) : null;

        let projectedItems = [...items]
        let newQty = 1

        if (existing) {
            newQty = existing.qty + 1
            projectedItems = items.map(i => i.cartItemId === existing.cartItemId ? { ...i, qty: newQty } : i)
        } else {
            // Mock item for validation
            const tempItem: any = { ...product, qty: 1 }
            projectedItems.push(tempItem)
        }

        const check = await validateStock(projectedItems)
        if (!check.valid) {
            toast.error(check.error)
            return
        }

        // Prioritize sale_uom if available
        const saleUoMId = (product as any).sale_uom
        const defaultUoM = saleUoMId || product.uom
        const uomName = uoms?.find(u => u.id === defaultUoM)?.name || (product as any).uom_name

        if (existing) {
            // Recalculate prices
            const prices = await fetchEffectivePrice(product, newQty, existing.uom)
            setItems(prevItems => prevItems.map(i => i.cartItemId === existing.cartItemId
                ? {
                    ...i,
                    qty: newQty,
                    unit_price_net: prices.net,
                    unit_price_gross: prices.gross,
                    total_net: PricingUtils.calculateLineNet(newQty, prices.net),
                    total_gross: Math.round(newQty * prices.gross),
                    manufacturing_data: mfgData || i.manufacturing_data
                }
                : i
            ))
        } else {
            const prices = await fetchEffectivePrice(product, 1, defaultUoM)
            setItems(prevItems => [...prevItems, {
                ...product,
                cartItemId: Math.random().toString(36).substring(2, 9),
                qty: 1,
                uom: defaultUoM,
                uom_name: uomName,
                unit_price_net: prices.net,
                unit_price_gross: prices.gross,
                total_net: PricingUtils.calculateLineNet(1, prices.net),
                total_gross: prices.gross,
                manufacturing_data: mfgData
            }])
        }
    }

    const addToCart = async (product: Product, mfgData?: any) => {
        // If product has variants, open modal instead of adding directly
        if (product.has_variants) {
            setActiveParentProduct(product)
            setEditingCartItem(null)
            setVariantModalOpen(true)
            return
        }

        await addProductToCart(product, mfgData)
    }


    const updateQty = async (cartItemId: string, qty: number | string) => {
        const item = items.find(i => i.cartItemId === cartItemId)
        if (!item) return

        let newQty = typeof qty === 'string' ? parseFloat(qty) : qty
        if (isNaN(newQty) || newQty < 0.01) newQty = 1

        let maxQty = Infinity
        const product_type = item.product_type
        const has_bom = item.has_bom || (item as any).has_active_bom

        if (product_type === 'STORABLE') maxQty = item.current_stock || 0
        if (product_type === 'MANUFACTURABLE' && has_bom) {
            maxQty = item.manufacturable_quantity ?? 0
        }

        if (newQty > maxQty) {
            newQty = maxQty
            toast.info(`Stock/Producción máxima: ${maxQty}`)
        }

        // Validate Shared Stock 
        const projectedItems = items.map(i => i.cartItemId === cartItemId ? { ...i, qty: newQty } : i)
        const check = await validateStock(projectedItems)

        if (!check.valid) {
            toast.error(check.error)
            // If invalid, we don't update to the new quantity. 
            // We could revert, but since it's an input, we just don't set the state.
            // However, the input is controlled. We should probably set it back to previous or max valid.
            // For now, let's just toast and stay at previous valid?
            // Actually, if we don't call setItems, the UI might desync from the input value depending on how it's handled. 
            // The input value is value={item.qty}. If we don't update item.qty, it snaps back.
            return
        }

        const prices = await fetchEffectivePrice(item, newQty, item.uom)

        setItems(prevItems => prevItems.map(i => {
            if (i.cartItemId === cartItemId) {
                return {
                    ...i,
                    qty: newQty,
                    unit_price_net: prices.net,
                    unit_price_gross: prices.gross,
                    total_net: PricingUtils.calculateLineNet(newQty, prices.net),
                    total_gross: Math.round(newQty * prices.gross)
                }
            }
            return i
        }))
    }

    const removeItem = (cartItemId: string) => {
        setItems(items.filter(i => i.cartItemId !== cartItemId))
    }

    const editVariantInCart = (item: CartItem) => {
        // Find parent product
        const parentId = (item as any).parent_template
        if (!parentId) return

        // We might need to fetch the parent product if it's not in the list (though usually it is as categories only show parents)
        const parent = products.find(p => p.id === parentId)
        if (parent) {
            setActiveParentProduct(parent)
            setEditingCartItem(item)
            setVariantModalOpen(true)
        }
    }

    const handleVariantSelected = async (variant: any) => {
        // Ensure has_bom is set for the variant based on its active BOM status
        const variantWithBom = {
            ...variant,
            has_bom: variant.has_active_bom
        }

        // Pre-fetch BOM validation
        if ((variant.product_type === 'MANUFACTURABLE' || variant.requires_advanced_manufacturing) && variant.has_active_bom && !bomCache[variant.id]) {
            await fetchBOM(variant.id)
        }

        if (editingCartItem) {
            // Updating existing line
            const projectedItems = items.map(i => i.cartItemId === editingCartItem.cartItemId ? {
                ...i,
                ...variantWithBom
            } : i) // Preserve qty of editing item but change product details

            const check = await validateStock(projectedItems)
            if (!check.valid) {
                toast.error(check.error)
                return
            }

            const prices = await fetchEffectivePrice(variantWithBom, editingCartItem.qty, variantWithBom.uom)
            setItems(prev => prev.map(i => i.cartItemId === editingCartItem.cartItemId ? {
                ...i,
                ...variantWithBom,
                unit_price_net: prices.net,
                unit_price_gross: prices.gross,
                total_net: PricingUtils.calculateLineNet(i.qty, prices.net),
                total_gross: Math.round(i.qty * prices.gross)
            } : i))
            setEditingCartItem(null)
        } else {
            // Adding new line
            // Use addProductToCart directly to bypass variant check
            await addProductToCart(variantWithBom)
        }
    }

    const handleConfirm = () => {
        if (items.length === 0) {
            toast.error("El carrito está vacío")
            return
        }

        const invalidItems = items.filter(i => {
            const original = products.find(p => p.id === i.id)
            return original?.is_dynamic_pricing && (i.unit_price_net <= 0)
        })

        if (invalidItems.length > 0) {
            toast.error("Hay productos con precio dinámico sin asignar (precio 0). Por favor asigne un precio unitario antes de continuar.")
            return
        }

        setCheckoutOpen(true)
    }

    // Draft Cart Functions
    const saveDraft = async (showToast = true, autoSaveName = false) => {
        if (!currentSession?.id) {
            if (showToast) toast.error("No hay sesión activa")
            return
        }

        if (items.length === 0) {
            if (showToast) toast.info("El carrito está vacío")
            return
        }

        setSaving(true)
        try {
            const draftData = {
                pos_session_id: currentSession.id,
                items: items,
                customer_id: selectedCustomerId,
                name: autoSaveName
                    ? `Auto-guardado ${new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}`
                    : draftName || `Borrador ${new Date().toLocaleString('es-CL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
                notes: ""
            }

            let response
            if (currentDraftId) {
                // Update existing draft
                response = await api.put(`/sales/draft-carts/${currentDraftId}/`, draftData)
            } else {
                // Create new draft
                response = await api.post('/sales/draft-carts/', draftData)
                setCurrentDraftId(response.data.id)
            }

            setLastSaved(new Date())
            if (showToast) {
                toast.success("Borrador guardado exitosamente")
            }
        } catch (error: any) {
            console.error("Error al guardar borrador:", error)
            if (showToast) {
                toast.error(error.response?.data?.error || "Error al guardar borrador")
            }
        } finally {
            setSaving(false)
        }
    }

    const loadDraft = (draft: any) => {
        try {
            // Load items
            setItems(draft.items || [])

            // Load customer
            setSelectedCustomerId(draft.customer)

            // Load draft metadata
            setCurrentDraftId(draft.id)
            setDraftName(draft.name)
            setLastSaved(new Date(draft.updated_at))

            toast.success(`Borrador "${draft.name}" cargado`)
        } catch (error) {
            console.error("Error al cargar borrador:", error)
            toast.error("Error al cargar el borrador")
        }
    }

    // Auto-save every 30 seconds
    useEffect(() => {
        if (!currentSession?.id || items.length === 0) return

        const timer = setTimeout(() => {
            saveDraft(false, true)
        }, 30000) // 30 seconds

        return () => clearTimeout(timer)
    }, [items, currentSession, selectedCustomerId])


    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault()
            const term = searchTerm.toLowerCase().trim()
            if (!term) return

            // 1. Try exact code match
            const exactMatch = products.find(p => p.code.toLowerCase() === term)
            if (exactMatch) {
                addToCart(exactMatch)
                setSearchTerm("")
                return
            }

            // 2. If not exact, check if filtered list has exactly one result
            if (filteredProducts.length === 1) {
                addToCart(filteredProducts[0])
                setSearchTerm("")
            }
        }
    }

    const total_gross_sum = items.reduce((acc, i) => acc + i.total_gross, 0)
    const total_net_sum = Math.round(total_gross_sum / 1.19)
    const total_tax_sum = total_gross_sum - total_net_sum

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 space-y-4">
            <div className="flex items-center justify-between py-1 px-1 mb-1">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold tracking-tight">
                        {currentSession?.treasury_account_name || "Punto de Venta"}
                    </h2>

                    {/* Session Status Badge */}
                    {currentSession && currentSession.status === 'OPEN' && (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-600 gap-1 px-2 py-0.5 text-[10px] items-center h-5">
                            <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                            Caja Abierta
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Actions Dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2">
                                <LayoutGrid className="h-4 w-4" />
                                Menú
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel>Acciones de Caja</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDraftsListOpen(true)}>
                                <Save className="mr-2 h-4 w-4" />
                                <span>Ver Borradores</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sessionControlRef.current?.showXReport()}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                <span>Reporte X (Parcial)</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                                <a href="/sales/orders" className="cursor-pointer flex items-center">
                                    <FileText className="mr-2 h-4 w-4" />
                                    <span>Notas de Venta</span>
                                </a>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Session Close Button */}
                    <SessionControl
                        ref={sessionControlRef}
                        onSessionChange={setCurrentSession}
                        hideSessionInfo={true}
                    />
                </div>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
                {(!currentSession || currentSession.status !== 'OPEN') && (
                    <div className="absolute inset-0 z-30 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                        <Card className="w-full max-w-md shadow-2xl border-primary/20 animate-in fade-in zoom-in duration-300">
                            <CardHeader className="text-center pb-2">
                                <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2">
                                    <LucideIcons.Lock className="h-8 w-8 text-primary" />
                                </div>
                                <CardTitle className="text-2xl">Caja Cerrada</CardTitle>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">
                                        Debe abrir una sesión de caja para realizar ventas.
                                    </p>
                                </div>
                            </CardHeader>
                            <CardContent className="flex justify-center pb-8">
                                {/* Use a specific ID to target the header control or just guide user */}
                                <SessionControl onSessionChange={setCurrentSession} />
                            </CardContent>
                        </Card>
                    </div>
                )}
                {/* Left: Product List / Search */}
                <div className="md:col-span-12 lg:col-span-7 flex flex-col min-h-0">
                    <Card className="flex-1 flex flex-col overflow-hidden shadow-none bg-muted/20 border">
                        <CardHeader className="pb-3 px-6 border-b bg-background/50 rounded-t-xl">
                            <div className="flex flex-col gap-4">
                                <div className="relative">
                                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Buscar por nombre o código..."
                                        className="pl-8"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        onKeyDown={handleSearchKeyDown}
                                        autoFocus
                                    />
                                </div>
                                <div className="relative flex items-center group">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 absolute left-0 z-10 bg-background/80 backdrop-blur shadow-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => categoryScrollRef.current?.scrollBy({ left: -200, behavior: 'smooth' })}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>

                                    <div
                                        ref={categoryScrollRef}
                                        className="flex gap-2 overflow-x-auto pb-1 no-scrollbar scroll-smooth"
                                    >
                                        <Badge
                                            variant={selectedCategoryId === null ? "default" : "outline"}
                                            className="cursor-pointer whitespace-nowrap"
                                            onClick={() => setSelectedCategoryId(null)}
                                        >
                                            Todos
                                        </Badge>
                                        {categories.map(cat => (
                                            <Badge
                                                key={cat.id}
                                                variant={selectedCategoryId === cat.id ? "default" : "outline"}
                                                className="cursor-pointer whitespace-nowrap flex items-center gap-1"
                                                onClick={() => setSelectedCategoryId(cat.id)}
                                            >
                                                {cat.icon && <DynamicIcon name={cat.icon} className="h-3 w-3" />}
                                                {cat.name}
                                            </Badge>
                                        ))}
                                    </div>

                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 absolute right-0 z-10 bg-background/80 backdrop-blur shadow-sm rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                        onClick={() => categoryScrollRef.current?.scrollBy({ left: 200, behavior: 'smooth' })}
                                    >
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-6 pt-4">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {filteredProducts.map(product => {
                                    const categoryId = typeof product.category === 'object' ? product.category?.id : product.category
                                    const catData = categories.find(c => Number(c.id) === Number(categoryId))
                                    const categoryIcon = (typeof product.category === 'object' ? product.category?.icon : catData?.icon) || null

                                    return (
                                        <Card
                                            key={product.id}
                                            className={cn(
                                                "cursor-pointer hover:border-primary transition-all active:scale-95 relative flex flex-col overflow-hidden group",
                                                // Disable if STORABLE with no stock
                                                product.product_type === 'STORABLE' && (product.current_stock || 0) <= 0 && "opacity-50 pointer-events-none grayscale-[0.5]",
                                                // Disable if MANUFACTURABLE and quantity is 0 (specifically 0, not null/infinity), EXCEPT if has no BOM
                                                product.product_type === 'MANUFACTURABLE' && (product.manufacturable_quantity === 0) && product.has_bom && "opacity-50 pointer-events-none grayscale-[0.5]"
                                            )}
                                            onClick={() => addToCart(product)}
                                        >
                                            <div className="aspect-square bg-muted/50 flex items-center justify-center relative">
                                                {product.image ? (
                                                    <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <DynamicIcon name={categoryIcon || "Package"} className="h-10 w-10 text-muted-foreground/30 group-hover:scale-110 transition-transform" />
                                                )}

                                                {/* Stock/Availability Badge */}
                                                {product.product_type === 'STORABLE' && (
                                                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                                        <div className={`h-2 w-2 rounded-full ${(limits[`prod_${product.id}`] ?? product.current_stock ?? 0) > 0 ? 'bg-green-500' : 'bg-red-500'}`} />
                                                        {limits[`prod_${product.id}`] ?? product.current_stock ?? 0}
                                                    </div>
                                                )}
                                                {product.product_type === 'MANUFACTURABLE' && (
                                                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                                        <div className={`h-2 w-2 rounded-full ${(() => {
                                                            const limit = limits[`prod_${product.id}`]
                                                            const max = limit !== undefined ? limit : (product.manufacturable_quantity ?? Infinity)
                                                            return max > 0 ? 'bg-blue-500' : 'bg-red-500'
                                                        })()}`} />
                                                        {(() => {
                                                            const limit = limits[`prod_${product.id}`]
                                                            const max = limit !== undefined ? limit : (product.manufacturable_quantity)
                                                            if (max === null || max === undefined || max > 999999) return 'Disponible'
                                                            return `${max} fab.`
                                                        })()}
                                                    </div>
                                                )}
                                                {(product.product_type === 'SERVICE' || product.product_type === 'SUBSCRIPTION' || product.product_type === 'CONSUMABLE') && (
                                                    <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-background/90 p-1 px-2 rounded-full shadow-sm border text-[10px] font-medium">
                                                        <div className="h-2 w-2 rounded-full bg-green-500" />
                                                        Disponible
                                                    </div>
                                                )}
                                            </div>
                                            <CardContent className="p-2 text-center flex-1 flex flex-col justify-center">
                                                <div className="font-bold text-sm line-clamp-2">{product.name}</div>
                                                <div className="text-primary font-semibold text-base mt-1">
                                                    {product.is_dynamic_pricing ? (
                                                        <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 bg-amber-50">Precio Dinámico</Badge>
                                                    ) : (
                                                        <>
                                                            {formatCurrency(PricingUtils.netToGross(Number(product.sale_price)))}
                                                            <span className="text-[10px] text-muted-foreground ml-1">c/IVA</span>
                                                        </>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap justify-center gap-1 mt-1">
                                                    {product.internal_code && (
                                                        <Badge variant="outline" className="text-[9px] h-3.5 px-1 font-normal opacity-70 uppercase">
                                                            {product.internal_code}
                                                        </Badge>
                                                    )}
                                                    {product.code && product.code !== product.internal_code && (
                                                        <Badge variant="secondary" className="text-[9px] h-3.5 px-1 font-normal opacity-70 uppercase">
                                                            {product.code}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    )
                                })}
                                {filteredProducts.length === 0 && (
                                    <div className="col-span-full text-center py-10 text-muted-foreground">
                                        No se encontraron productos.
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Cart & Totals */}
                <div className="md:col-span-12 lg:col-span-5 flex flex-col min-h-0 overflow-hidden">
                    <Card className="flex-1 flex flex-col overflow-hidden border">
                        <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                            <div className="p-4 px-6 border-b font-medium bg-muted/50 flex justify-between items-center">
                                <span>Resumen de Venta</span>
                                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{items.length} items</span>
                            </div>
                            <div className="flex-1 overflow-auto">
                                <Table>
                                    <TableHeader className="bg-muted/30 sticky top-0 z-10">
                                        <TableRow className="hover:bg-transparent border-b">
                                            <TableHead className="w-[25%] text-xs py-2">Producto</TableHead>
                                            <TableHead className="w-[15%] text-xs py-2 text-center">Cant.</TableHead>
                                            <TableHead className="w-[15%] text-xs py-2 text-center">Unidad</TableHead>
                                            <TableHead className="w-[15%] text-xs py-2 text-right">Precio Unit.</TableHead>
                                            <TableHead className="w-[20%] text-xs py-2 text-right">Total</TableHead>
                                            <TableHead className="w-[10%] py-2"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {items.map((item) => {
                                            const originalProduct = products.find(p => p.id === item.id)
                                            const itemUom = uoms.find(u => u.id === item.uom)

                                            let allowedUoMs: any[] = []
                                            if (originalProduct && (originalProduct as any).allowed_sale_uoms?.length > 0) {
                                                const allowedIds = (originalProduct as any).allowed_sale_uoms
                                                const saleUoMId = (originalProduct as any).sale_uom
                                                allowedUoMs = uoms.filter(u => allowedIds.includes(u.id) || u.id === saleUoMId)
                                            } else if (itemUom) {
                                                allowedUoMs = uoms.filter(u => u.category === itemUom.category)
                                            }

                                            return (
                                                <TableRow key={item.cartItemId} className="group border-b hover:bg-muted/30 transition-colors">
                                                    <TableCell className="py-2 align-top">
                                                        <div className="flex flex-col gap-0.5">
                                                            <span className="font-bold text-xs truncate max-w-[150px]" title={item.name}>
                                                                {item.name}
                                                            </span>
                                                            <div className="flex flex-wrap gap-1">
                                                                {item.internal_code && (
                                                                    <Badge variant="outline" className="text-[8px] h-3 px-1 font-normal opacity-70 uppercase">
                                                                        {item.internal_code}
                                                                    </Badge>
                                                                )}
                                                                {item.code && item.code !== item.internal_code && (
                                                                    <Badge variant="secondary" className="text-[8px] h-3 px-1 font-normal opacity-70 uppercase">
                                                                        {item.code}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 align-top">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <Input
                                                                type="number"
                                                                className={cn(
                                                                    "h-7 w-12 text-center text-xs font-bold bg-background border-none focus-visible:ring-1 focus-visible:ring-primary shadow-none p-0",
                                                                    (() => {
                                                                        const maxQty = limits[`cart_${item.cartItemId}`] ?? Infinity
                                                                        return item.qty > maxQty ? "text-red-600 bg-red-50 rounded" : ""
                                                                    })()
                                                                )}
                                                                value={item.qty}
                                                                onChange={(e) => updateQty(item.cartItemId, e.target.value)}
                                                                min="0.01"
                                                            />
                                                            {(() => {
                                                                const maxQty = limits[`cart_${item.cartItemId}`]
                                                                if (maxQty !== undefined && maxQty !== Infinity) {
                                                                    return (
                                                                        <Badge variant="secondary" className={cn("text-[8px] px-1 h-3.5 bg-muted text-muted-foreground hover:bg-muted font-normal border-0 whitespace-nowrap", item.qty > maxQty && "text-red-600 bg-red-50")}>
                                                                            MAX: {maxQty}
                                                                        </Badge>
                                                                    )
                                                                }
                                                                return null
                                                            })()}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 align-top">
                                                        <div className="flex justify-center">
                                                            {allowedUoMs.length > 1 ? (
                                                                <Select
                                                                    value={item.uom?.toString()}
                                                                    onValueChange={async (val) => {
                                                                        const newUom = uoms.find(u => u.id.toString() === val)
                                                                        const uomId = parseInt(val)
                                                                        const prices = await fetchEffectivePrice(item, item.qty, uomId)

                                                                        setItems(prevItems => prevItems.map(i => i.cartItemId === item.cartItemId ? {
                                                                            ...i,
                                                                            uom: uomId,
                                                                            uom_name: newUom?.name,
                                                                            unit_price_net: prices.net,
                                                                            unit_price_gross: prices.gross,
                                                                            total_net: PricingUtils.calculateLineNet(i.qty, prices.net),
                                                                            total_gross: Math.round(i.qty * prices.gross)
                                                                        } : i))
                                                                    }}
                                                                >
                                                                    <SelectTrigger className="h-6 text-[10px] w-auto border-none bg-muted/50 py-0 px-2 min-h-0 focus:ring-0">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {allowedUoMs.map(u => (
                                                                            <SelectItem key={u.id} value={u.id.toString()} className="text-[10px]">
                                                                                {u.name}
                                                                            </SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <span className="text-[10px] font-medium text-muted-foreground/80 bg-muted/30 px-1.5 py-0.5 rounded leading-none">
                                                                    {item.uom_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right align-top">
                                                        <div className="flex flex-col items-end gap-1">
                                                            {originalProduct?.is_dynamic_pricing ? (
                                                                <>
                                                                    <Input
                                                                        type="number"
                                                                        className="h-7 w-20 text-right text-xs bg-background border-none focus-visible:ring-1 focus-visible:ring-primary shadow-none p-0 pr-1"
                                                                        value={item.unit_price_gross || ""}
                                                                        placeholder="0"
                                                                        onChange={async (e) => {
                                                                            const newGross = parseFloat(e.target.value) || 0
                                                                            const newNet = PricingUtils.grossToNet(newGross)

                                                                            setItems(prevItems => prevItems.map(i => i.cartItemId === item.cartItemId ? {
                                                                                ...i,
                                                                                unit_price_net: newNet,
                                                                                unit_price_gross: newGross,
                                                                                total_net: PricingUtils.calculateLineNet(i.qty, newNet),
                                                                                total_gross: Math.round(i.qty * newGross)
                                                                            } : i))
                                                                        }}
                                                                    />
                                                                    <span className="text-[9px] text-muted-foreground leading-none">
                                                                        Neto: {formatCurrency(item.unit_price_net)}
                                                                    </span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="text-xs font-medium">
                                                                        {formatCurrency(item.unit_price_gross)}
                                                                    </span>
                                                                    <span className="text-[9px] text-muted-foreground leading-none">
                                                                        Neto: {formatCurrency(item.unit_price_net)}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-right align-top">
                                                        <div className="flex flex-col items-end">
                                                            <span className="font-black text-xs">
                                                                {formatCurrency(item.total_gross)}
                                                            </span>
                                                            <span className="text-[9px] text-muted-foreground leading-none">
                                                                Neto: {formatCurrency(item.total_net)}
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="py-2 text-center align-top">
                                                        <div className="flex gap-1">
                                                            {((item as any).parent_template) && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                    onClick={() => editVariantInCart(item)}
                                                                >
                                                                    <Edit2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            )}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                onClick={() => removeItem(item.cartItemId)}
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                        {items.length === 0 && (
                                            <TableRow>
                                                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground text-xs italic">
                                                    Carrito vacío
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                            <div className="p-4 bg-muted/20 border-t space-y-4">
                                {/* Status Bar (Subtle) */}
                                <div className="flex justify-between items-center px-1 min-h-[16px]">
                                    <div>
                                        {currentDraftId && (
                                            <Badge variant="outline" className="text-[10px] h-4 px-1 bg-background font-normal text-muted-foreground uppercase tracking-widest border-muted-foreground/20">
                                                Modo Borrador
                                            </Badge>
                                        )}
                                    </div>
                                    {lastSaved && (
                                        <div className="flex items-center text-[10px] text-muted-foreground gap-1 opacity-70">
                                            <Clock className="h-3 w-3" />
                                            <span>
                                                {saving ? "Guardando..." : `Actualizado: ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                            </span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1">
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>Neto</span>
                                        <span>{formatCurrency(total_net_sum)}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-muted-foreground">
                                        <span>IVA (19%)</span>
                                        <span>{formatCurrency(total_tax_sum)}</span>
                                    </div>
                                    <div className="flex justify-between text-xl font-bold pt-2 border-t">
                                        <span>Total</span>
                                        <span>{formatCurrency(total_gross_sum)}</span>
                                    </div>
                                </div>
                                <Button
                                    className="w-full h-12 text-lg shadow-lg"
                                    size="lg"
                                    disabled={loading || items.length === 0}
                                    onClick={handleConfirm}
                                >
                                    <ShoppingCart className="mr-2 h-5 w-5" />
                                    {loading ? "Procesando..." : "Confirmar Venta"}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {variantModalOpen && (
                <POSVariantSelectorModal
                    open={variantModalOpen}
                    onOpenChange={setVariantModalOpen}
                    product={activeParentProduct}
                    onSelect={handleVariantSelected}
                    initialVariantId={editingCartItem?.id}
                    items={items}
                    bomCache={bomCache}
                    componentCache={componentCache}
                    calculateMaxQty={calculateMaxQty}
                />
            )}

            {
                checkoutOpen && (
                    <SalesCheckoutWizard
                        open={checkoutOpen}
                        onOpenChange={setCheckoutOpen}
                        order={null}
                        orderLines={items}
                        total={total_gross_sum}
                        posSessionId={currentSession?.id}
                        onComplete={() => {
                            setItems([])
                            setCurrentDraftId(null)
                            setDraftName("")
                            setLastSaved(null)
                            setSelectedCustomerId(null)
                        }}
                    />
                )
            }

        </div >
    )
}
