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
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { LayoutGrid, FileText, ChevronDown, BarChart3, Save, Lock, ArrowRightLeft, LogOut } from 'lucide-react'
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
import { LAYOUT_TOKENS } from "@/lib/styles"
import { cn } from "@/lib/utils"

// Context and Hooks
import { POSProvider, usePOS } from './contexts/POSContext'
import { useAuth } from '@/contexts/AuthContext'
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
        setSelectedCustomerId,
        defaultCustomerId,
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

    const { user } = useAuth()

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
        lastSaved,
        deleteDraft,
        fetchDrafts
    } = useDrafts()

    // Products management
    const {
        filteredProducts,
        categories,
        searchTerm,
        setSearchTerm,
        selectedCategoryId,
        setSelectedCategoryId,
        limits: productLimits,
        setLimits: setProductLimits,
        refreshProducts
    } = useProducts()

    // Refresh products when a draft is saved to update stock indicators (silent)
    useEffect(() => {
        if (lastSaved) {
            refreshProducts(true)
        }
    }, [lastSaved, refreshProducts])

    // Refs
    const sessionControlRef = useRef<SessionControlHandle>(null)
    const scannerFeedbackRef = useRef<ScannerFeedbackHandle>(null)

    // Query client for cache invalidation
    const queryClient = useQueryClient()
    const searchParams = useSearchParams()

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
    const [isSharedSession, setIsSharedSession] = useState(false)
    const draftLoadedFromUrl = useRef(false)

    // Track shared session state
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsSharedSession(!!localStorage.getItem('shared_pos_session_id'))
        }
    }, [currentSession])

    // Load Draft from URL if present
    useEffect(() => {
        const draftIdStr = searchParams.get('draftId')
        if (draftIdStr && currentSession?.id && !loading && !draftLoadedFromUrl.current) {
            const dId = parseInt(draftIdStr)
            if (!isNaN(dId)) {
                draftLoadedFromUrl.current = true
                console.log("Loading draft from URL:", dId)
                // Small delay to ensure POS is fully initialized
                setTimeout(() => {
                    loadDraft(dId).then(() => {
                        // Drafts from approval (from notifications) are essentially checkouts in progress
                        setCheckoutOpen(true)
                    }).catch((err) => {
                        console.error("Failed to load draft from URL", err)
                    })
                }, 500)
            }
        }
    }, [searchParams, currentSession?.id, loading, loadDraft])

    // Auto-save drafts
    useEffect(() => {
        if (!currentSession?.id || items.length === 0 || loading || wizardState?.isLoading) return

        // Skip auto-save if the wizard is in a loading/transition state (e.g. processing final checkout)
        if (wizardState?.isLoading) return

        const timer = setTimeout(() => {
            saveDraft(undefined, true)
        }, 2000)

        return () => clearTimeout(timer)
    }, [items, selectedCustomerId, wizardState, currentSession, loading])

    // Sync customer from Wizard back to POS Context
    useEffect(() => {
        const wizardCustomerId = wizardState?.selectedCustomerId
        if (wizardCustomerId && wizardCustomerId !== selectedCustomerId?.toString()) {
            const parsedId = parseInt(wizardCustomerId)
            if (!isNaN(parsedId)) {
                setSelectedCustomerId(parsedId)
            }
        }
    }, [wizardState?.selectedCustomerId, selectedCustomerId, setSelectedCustomerId])

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
        // Reset wizard state for a fresh sale (prevents stale data from previous sale)
        setWizardState({
            step: 1,
            isQuickSale: false
        })
        setCheckoutOpen(true)
    }

    const handleCheckoutComplete = async () => {
        // Clear local state IMMEDIATELY to prevent auto-save from recreating the draft
        // The backend already deleted it, so we must stop referring to it globally
        setCurrentDraftId(null)
        setWizardState(null)
        clearCart()

        // Refresh drafts list without full loading indicator to sync with backend deletion
        await fetchDrafts()

        // Invalidate sales cache so the Sales Notes modal shows the new sale immediately
        queryClient.invalidateQueries({ queryKey: ['sales'] })

        setCheckoutOpen(false)
        toast.success("Venta completada exitosamente")
    }


    const handleQuickSale = () => {
        const quickSaleCheck = Validation.canQuickSale(items, selectedCustomerId)
        if (!quickSaleCheck.allowed) {
            toast.error(quickSaleCheck.reason)
            return
        }

        // Force default customer for quick sale if none selected
        if (!selectedCustomerId && defaultCustomerId) {
            setSelectedCustomerId(defaultCustomerId)
        }

        // Determine last step (Payment) based on items
        const currentIsOnlyService = items.every(line => line.product_type === 'SERVICE');
        const currentHasManufacturing = items.some(line =>
            (line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing) ||
            (line.product_type === 'MANUFACTURABLE' && !line.has_bom)
        );
        const lastStep = (currentIsOnlyService ? 3 : 4) + (currentHasManufacturing ? 1 : 0);

        // Open checkout in quick sale mode, pre-filling defaults
        const quickSaleState = {
            step: lastStep,
            dteData: {
                type: 'BOLETA', // Default to Boleta
                number: '',
                date: new Date().toISOString().split('T')[0],
                attachment: null,
                isPending: false
            },
            deliveryData: {
                type: 'IMMEDIATE', // Default to Immediate
                date: null,
                notes: ''
            }
        }

        setWizardState({
            ...quickSaleState,
            isQuickSale: true
        } as any)

        // Use a small timeout to ensure wizardState is committed to React's state 
        // before the modal opens, guaranteeing the hydration effect reads the fresh props
        setTimeout(() => setCheckoutOpen(true), 0)
    }

    // Draft handlers
    const handleLoadDraft = async (draft: any) => {
        await loadDraft(draft.id)
        setDraftsListOpen(false)
        // Only reopen the wizard if the draft was saved mid-checkout;
        // pure cart drafts (no wizard_state) just restore the items.
        if (draft.wizard_state && draft.wizard_state.step) {
            setCheckoutOpen(true)
        }
    }

    const quickSaleEligibility = Validation.canQuickSale(items, selectedCustomerId)

    return (
        <div className={cn("flex-1 p-4 pt-2 flex flex-col gap-2 overflow-hidden animate-in fade-in duration-500")}>
            {/* Header */}
            <div className="flex items-center justify-between py-1 px-1 mb-1">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold tracking-tight">
                        {currentSession?.terminal_name || "Punto de Venta"}
                    </h2>

                    {currentSession && currentSession.status === 'OPEN' && (
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary gap-1 px-2 py-0.5 text-[10px] items-center h-5 font-bold">
                                Sesión #{currentSession.id}
                            </Badge>
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 gap-1.5 px-2 py-0.5 text-[10px] items-center h-5 font-medium">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                Cajero: {user?.first_name} {user?.last_name}
                            </Badge>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    {/* Quick Drafts - Horizontal access */}
                    {drafts.length > 0 && (
                        <div className="hidden lg:flex items-center gap-1 mr-2 animate-in fade-in slide-in-from-right-2">
                            {drafts.slice(0, 5).map((draft) => (
                                <Button
                                    key={draft.id}
                                    variant="outline"
                                    size="sm"
                                    className={cn(
                                        "h-8 w-8 p-0 text-[10px] font-mono font-bold border-dashed hover:border-primary hover:text-primary transition-all",
                                        currentDraftId === draft.id ? "bg-primary/5 border-primary text-primary" : "bg-background/50 text-muted-foreground"
                                    )}
                                    onClick={() => handleLoadDraft(draft)}
                                    title={`${draft.name} · ${draft.item_count} ítem(s)`}
                                >
                                    {draft.id}
                                </Button>
                            ))}
                        </div>
                    )}

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
                            <DropdownMenuLabel>Menú de Operaciones</DropdownMenuLabel>
                            <DropdownMenuSeparator />

                            <DropdownMenuItem onClick={() => setDraftsListOpen(true)}>
                                <Save className="mr-2 h-4 w-4" />
                                <span>Ver Borradores</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => sessionControlRef.current?.showXReport()}>
                                <BarChart3 className="mr-2 h-4 w-4" />
                                <span>Reporte Parcial</span>
                            </DropdownMenuItem>

                            <DropdownMenuItem onClick={() => setOrdersModalOpen(true)}>
                                <FileText className="mr-2 h-4 w-4" />
                                <span>Notas de Venta</span>
                            </DropdownMenuItem>

                            {currentSession?.status === 'OPEN' && (
                                <>

                                    <DropdownMenuItem onClick={() => sessionControlRef.current?.showMoveDialog()}>
                                        <ArrowRightLeft className="mr-2 h-4 w-4" />
                                        <span>Movimiento de Caja</span>
                                    </DropdownMenuItem>

                                    {isSharedSession ? (
                                        <DropdownMenuItem
                                            onClick={() => sessionControlRef.current?.disconnectSharedSession()}
                                            className="text-red-600 focus:text-red-700 focus:bg-red-50 font-medium"
                                        >
                                            <LogOut className="mr-2 h-4 w-4" />
                                            <span>Desconectar de Caja</span>
                                        </DropdownMenuItem>
                                    ) : (
                                        <DropdownMenuItem
                                            onClick={() => sessionControlRef.current?.requestCloseSession()}
                                            className="text-red-600 focus:text-red-700 focus:bg-red-50 font-medium"
                                        >
                                            <Lock className="mr-2 h-4 w-4" />
                                            <span>Cerrar Caja</span>
                                        </DropdownMenuItem>
                                    )}
                                </>
                            )}
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
                key={`checkout-wizard-${wizardState?.isQuickSale ? 'quick' : 'normal'}-${checkoutOpen ? 'open' : 'closed'}`}
                open={checkoutOpen}
                onOpenChange={setCheckoutOpen}
                order={null}
                orderLines={items}
                total={totals.total_gross}
                totalDiscountAmount={totalDiscountAmount}
                onComplete={handleCheckoutComplete}
                initialCustomerId={selectedCustomerId?.toString() || (wizardState?.isQuickSale ? defaultCustomerId?.toString() : undefined)}
                posSessionId={currentSession?.id}
                terminalId={currentSession?.terminal}
                quickSale={wizardState?.isQuickSale}
                initialStep={wizardState?.step}
                initialDteData={wizardState?.dteData}
                initialPaymentData={wizardState?.paymentData}
                initialDeliveryData={wizardState?.deliveryData}
                initialApprovalTaskId={wizardState?.approvalTaskId}
                initialIsWaitingApproval={wizardState?.isWaitingApproval}
                initialIsApproved={wizardState?.isApproved}
                initialDraftId={currentDraftId}
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
