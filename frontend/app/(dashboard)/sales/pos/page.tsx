"use client"

/**
 * POS Main Page - Refactored
 * 
 * This is the refactored version of the POS page using modular architecture:
 * - POSContext for centralized state
 * - Custom hooks for business logic
 * - Modular UI components
 * 
 * Reduced from 1486 lines to ~300 lines while maintaining all functionality
 */

import { useState, useRef, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LayoutGrid, FileText, ChevronDown, BarChart3, Save, Lock } from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import * as Validation from '@/lib/pos/validation'

// Context and Hooks
import { POSProvider, usePOS } from './contexts/POSContext'
import { useProducts } from './hooks/useProducts'
import { useCart } from './hooks/useCart'
import { useStockValidation } from './hooks/useStockValidation'
import { useDrafts } from './hooks/useDrafts'

// UI Components (always loaded - lightweight)
import { SearchBar } from './components/SearchBar'
import { CategoryFilter } from './components/CategoryFilter'
import { ProductGrid } from './components/ProductGrid'
import { Cart } from './components/Cart'

// Lightweight shared components
import { SessionControl, SessionControlHandle } from '@/components/pos/SessionControl'
import { ScannerFeedback, ScannerFeedbackHandle } from '@/components/pos/ScannerFeedback'
import { PricingUtils } from '@/lib/pricing'
import { SalesOrdersModal } from '@/components/pos/SalesOrdersModal'

// 🚀 Lazy-loaded heavy components (modals only used when triggered)
const SalesCheckoutWizard = dynamic(
    () => import('@/features/sales/components/SalesCheckoutWizard'),
    { ssr: false, loading: () => <div className="p-4">Cargando...</div> }
)

const POSVariantSelectorModal = dynamic(
    () => import('@/components/pos/POSVariantSelectorModal').then(mod => ({ default: mod.POSVariantSelectorModal })),
    { ssr: false }
)

const DraftCartsList = dynamic(
    () => import('@/components/pos/DraftCartsList').then(mod => ({ default: mod.DraftCartsList })),
    { ssr: false }
)

const NumpadModal = dynamic(
    () => import('@/components/pos/NumpadModal').then(mod => ({ default: mod.NumpadModal })),
    { ssr: false }
)

export default function POSPage() {
    return (
        <POSProvider>
            <POSPageContent />
        </POSProvider>
    )
}

function POSPageContent() {
    const {
        currentSession,
        setCurrentSession,
        selectedCustomerId,
        items,
        totals,
        loading,
        bomCache,
        componentCache,
        uoms,
        currentDraftId,
        setCurrentDraftId,
        wizardState,
        setWizardState,
        updateItem,
        totalDiscountAmount,
        setTotalDiscountAmount,
    } = usePOS()

    // Products management
    const {
        filteredProducts,
        categories,
        searchTerm,
        setSearchTerm,
        selectedCategoryId,
        setSelectedCategoryId,
        limits: productLimits,
        setLimits: setProductLimits
    } = useProducts()

    // Cart management
    const {
        addProductToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        canCheckout,
        fetchEffectivePrice
    } = useCart()

    // Stock validation
    const {
        limits: stockLimits,
        updateLimits,
        calculateMaxQty
    } = useStockValidation()

    // Drafts management
    const {
        saveDraft,
        loadDraft,
        drafts,
        isSaving,
        lastSaved
    } = useDrafts()

    // Refs
    const sessionControlRef = useRef<SessionControlHandle>(null)
    const scannerFeedbackRef = useRef<ScannerFeedbackHandle>(null)

    // Local UI state
    const [checkoutOpen, setCheckoutOpen] = useState(false)
    const [draftsListOpen, setDraftsListOpen] = useState(false)
    const [variantModalOpen, setVariantModalOpen] = useState(false)
    const [selectedProductForVariant, setSelectedProductForVariant] = useState<any>(null)
    const [numpadOpen, setNumpadOpen] = useState(false)
    const [numpadConfig, setNumpadConfig] = useState<{
        itemId: string | 'cart'
        field: 'qty' | 'price' | 'discount'
        initialValue: number
    } | null>(null)
    const [numpadValue, setNumpadValue] = useState("0")
    const [ordersModalOpen, setOrdersModalOpen] = useState(false)

    // Auto-save drafts
    useEffect(() => {
        if (!currentSession?.id || items.length === 0) return

        const timer = setTimeout(() => {
            saveDraft()
        }, 2000)

        return () => clearTimeout(timer)
    }, [items, selectedCustomerId, wizardState, currentSession])

    // Product click handler
    const handleProductClick = (product: any) => {
        if (product.has_variants && product.variants_count > 0) {
            setSelectedProductForVariant(product)
            setVariantModalOpen(true)
        } else {
            addProductToCart(product)
        }
    }

    // Search Enter handler
    const handleSearchEnter = () => {
        const term = searchTerm.toLowerCase().trim()
        if (!term) return

        // Try exact code match
        const exactMatch = filteredProducts.find(p =>
            p.code.toLowerCase() === term || p.internal_code?.toLowerCase() === term
        )

        if (exactMatch) {
            handleProductClick(exactMatch)
            setSearchTerm("")
            return
        }

        // If only one result, add it
        if (filteredProducts.length === 1) {
            handleProductClick(filteredProducts[0])
            setSearchTerm("")
            return
        }

        // Trigger error feedback
        scannerFeedbackRef.current?.triggerError()
    }

    // Numpad handlers
    const handleOpenNumpad = (itemId: string | 'cart', field: 'qty' | 'price' | 'discount', currentValue: number) => {
        setNumpadConfig({ itemId, field, initialValue: currentValue })
        setNumpadValue(currentValue.toString())
        setNumpadOpen(true)
    }

    const handleNumpadConfirm = (value: number) => {
        if (!numpadConfig) return

        if (numpadConfig.itemId === 'cart') {
            if (numpadConfig.field === 'discount') {
                handleTotalDiscountChange(value)
            }
        } else {
            if (numpadConfig.field === 'qty') {
                updateQuantity(numpadConfig.itemId, value)
            } else if (numpadConfig.field === 'price') {
                handleItemPriceChange(numpadConfig.itemId, value)
            } else if (numpadConfig.field === 'discount') {
                const item = items.find(i => i.cartItemId === numpadConfig.itemId)
                if (item) {
                    const totalBeforeDiscount = item.qty * item.unit_price_gross
                    const percent = totalBeforeDiscount > 0 ? (value / totalBeforeDiscount) * 100 : 0
                    handleItemDiscountChange(numpadConfig.itemId, value, percent)
                }
            }
        }

        setNumpadOpen(false)
        setNumpadConfig(null)
    }

    // Cart item handlers with price updates
    const handleItemUomChange = async (cartItemId: string, uomId: number, uomName: string) => {
        const item = items.find(i => i.cartItemId === cartItemId)
        if (!item) return

        const prices = await fetchEffectivePrice(item, item.qty, uomId)

        // Update via context
        updateItem(cartItemId, {
            uom: uomId,
            uom_name: uomName,
            unit_price_net: prices.net,
            unit_price_gross: prices.gross,
            total_net: PricingUtils.calculateLineNet(item.qty, prices.net),
            total_gross: Math.round(item.qty * prices.gross)
        })
    }

    const handleItemPriceChange = (cartItemId: string, priceGross: number) => {
        const item = items.find(i => i.cartItemId === cartItemId)
        if (!item) return

        const newNet = PricingUtils.grossToNet(priceGross)
        const linePricing = PricingUtils.calculateLineFromGross(item.qty, priceGross, item.discount_amount || 0)

        updateItem(cartItemId, {
            unit_price_net: newNet,
            unit_price_gross: priceGross,
            total_net: linePricing.net,
            total_gross: linePricing.gross
        })
    }

    const handleItemDiscountChange = (cartItemId: string, amount: number, percent: number) => {
        const item = items.find(i => i.cartItemId === cartItemId)
        if (!item) return

        const linePricing = PricingUtils.calculateLineFromGross(item.qty, item.unit_price_gross, amount)

        updateItem(cartItemId, {
            discount_amount: amount,
            discount_percentage: percent,
            total_net: linePricing.net,
            total_gross: linePricing.gross
        })
    }

    const handleTotalDiscountChange = (amount: number) => {
        setTotalDiscountAmount(amount)
    }

    // Checkout handlers
    const handleConfirmSale = () => {
        const check = canCheckout()
        if (!check.valid) {
            toast.error(check.error)
            return
        }
        setCheckoutOpen(true)
    }

    const handleCheckoutComplete = () => {
        clearCart()
        setCheckoutOpen(false)
        setCurrentDraftId(null)
        setWizardState(null)
        toast.success("Venta completada exitosamente")
    }

    const handleQuickSale = () => {
        const quickSaleCheck = Validation.canQuickSale(items, selectedCustomerId)
        if (!quickSaleCheck.allowed) {
            toast.error(quickSaleCheck.reason)
            return
        }

        // Open checkout in quick sale mode
        setCheckoutOpen(true)
    }

    // Draft handlers
    const handleLoadDraft = async (draft: any) => {
        await loadDraft(draft.id)
        setDraftsListOpen(false)
    }

    const quickSaleEligibility = Validation.canQuickSale(items, selectedCustomerId)

    return (
        <div className="flex flex-col h-[calc(100vh-4rem)] p-4 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between py-1 px-1 mb-1">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold tracking-tight">
                        {currentSession?.terminal_name || "Punto de Venta"}
                    </h2>

                    {currentSession && currentSession.status === 'OPEN' && (
                        <Badge variant="outline" className="border-emerald-500 text-emerald-600 gap-1 px-2 py-0.5 text-[10px] items-center h-5">
                            <div className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
                            Caja Abierta
                        </Badge>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Actions Menu */}
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
                            <DropdownMenuItem onClick={() => setOrdersModalOpen(true)}>
                                <FileText className="mr-2 h-4 w-4" />
                                <span>Notas de Venta</span>
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Session Control - Updates session state on open/close */}
                    <SessionControl
                        ref={sessionControlRef}
                        onSessionChange={setCurrentSession}
                        session={currentSession ?? undefined}
                        hideSessionInfo={true}
                    />
                </div>
            </div>

            {/* Main Content */}
            <div className="relative grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
                {/* Session Closed Overlay */}
                {currentSession !== undefined && (!currentSession || currentSession.status !== 'OPEN') && (
                    <div className="absolute inset-0 z-30 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                        <Card className="w-full max-w-md shadow-2xl border-primary/20 animate-in fade-in zoom-in duration-300">
                            <CardHeader className="text-center pb-2">
                                <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-2">
                                    <Lock className="h-8 w-8 text-primary" />
                                </div>
                                <CardTitle className="text-2xl">Caja Cerrada</CardTitle>
                                <div className="space-y-1">
                                    <p className="text-muted-foreground">
                                        Debe abrir una sesión de caja para realizar ventas.
                                    </p>
                                </div>
                            </CardHeader>
                            <CardContent className="flex justify-center pb-8">
                                <SessionControl
                                    onSessionChange={setCurrentSession}
                                    session={currentSession ?? undefined}
                                />
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* Left: Products */}
                <div className="md:col-span-12 lg:col-span-7 flex flex-col min-h-0">
                    <Card className="flex-1 flex flex-col overflow-hidden shadow-none bg-muted/20 border">
                        <CardHeader className="pb-3 px-6 border-b bg-background/50 rounded-t-xl">
                            <div className="flex flex-col gap-4">
                                <SearchBar
                                    value={searchTerm}
                                    onChange={setSearchTerm}
                                    onEnter={handleSearchEnter}
                                />
                                <CategoryFilter
                                    categories={categories}
                                    selectedCategoryId={selectedCategoryId}
                                    onSelectCategory={setSelectedCategoryId}
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-auto p-6 pt-4">
                            <ProductGrid
                                products={filteredProducts}
                                categories={categories}
                                limits={stockLimits}
                                onProductClick={handleProductClick}
                            />
                        </CardContent>
                    </Card>
                </div>

                {/* Right: Cart */}
                <div className="md:col-span-12 lg:col-span-5 flex flex-col min-h-0 overflow-hidden">
                    <Cart
                        items={items}
                        products={filteredProducts}
                        uoms={uoms}
                        limits={stockLimits}
                        totals={totals}
                        loading={loading}
                        currentDraftId={currentDraftId}
                        lastSaved={lastSaved || undefined}
                        saving={isSaving}
                        canQuickSale={quickSaleEligibility}
                        onItemQuantityChange={updateQuantity}
                        onItemUomChange={handleItemUomChange}
                        onItemPriceChange={handleItemPriceChange}
                        onItemDiscountChange={handleItemDiscountChange}
                        onItemRemove={removeFromCart}
                        onOpenNumpad={handleOpenNumpad}
                        onQuickSale={handleQuickSale}
                        onConfirmSale={handleConfirmSale}
                        totalDiscountAmount={totalDiscountAmount}
                        onTotalDiscountChange={setTotalDiscountAmount}
                    />
                </div>
            </div>

            {/* Modals */}
            <SalesCheckoutWizard
                open={checkoutOpen}
                onOpenChange={setCheckoutOpen}
                order={null}
                orderLines={items}
                total={totals.total_gross}
                onComplete={handleCheckoutComplete}
                initialCustomerId={selectedCustomerId?.toString()}
                posSessionId={currentSession?.id}
                terminalId={currentSession?.terminal}
                quickSale={false}
                initialStep={wizardState?.step}
                initialDteData={wizardState?.dte}
                initialPaymentData={wizardState?.payment}
                initialDeliveryData={wizardState?.delivery}
                onStateChange={setWizardState}
            />

            <POSVariantSelectorModal
                open={variantModalOpen}
                onOpenChange={setVariantModalOpen}
                product={selectedProductForVariant}
                onSelect={(variant) => {
                    addProductToCart(variant as any)
                }}
                items={items}
                bomCache={bomCache}
                componentCache={componentCache}
                calculateMaxQty={calculateMaxQty}
            />

            <DraftCartsList
                open={draftsListOpen}
                onOpenChange={setDraftsListOpen}
                posSessionId={currentSession?.id || null}
                onLoadDraft={handleLoadDraft}
                showTrigger={false}
            />

            <NumpadModal
                open={numpadOpen}
                onOpenChange={setNumpadOpen}
                title={numpadConfig?.field === 'qty' ? "Cantidad" : "Precio"}
                value={numpadValue}
                onChange={setNumpadValue}
                onConfirm={() => handleNumpadConfirm(parseFloat(numpadValue))}
                allowDecimal={true}
            />

            <ScannerFeedback ref={scannerFeedbackRef} />

            <SalesOrdersModal
                open={ordersModalOpen}
                onOpenChange={setOrdersModalOpen}
                posSessionId={currentSession?.id}
            />
        </div>
    )
}
