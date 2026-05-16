"use client"

import { getErrorMessage } from "@/lib/errors"
import { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useReactToPrint } from 'react-to-print'
import { useSearchParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Loader2, LayoutGrid, FileText, ChevronDown, BarChart3, Save, Lock, ArrowRightLeft, LogOut, ShoppingCart, Wallet } from 'lucide-react'
import { AnimatePresence, motion } from 'framer-motion'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import api from '@/lib/api'
import * as Validation from '@/features/pos/utils/validation'
import { cn } from "@/lib/utils"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Check, Printer } from 'lucide-react'
import { PrintableReceipt } from '@/components/shared/transaction-modal/PrintableReceipt'

import { POSProvider, usePOS } from '@/features/pos/contexts/POSContext'
import { useAuth } from '@/contexts/AuthContext'
import { 
    useProducts, 
    useCart, 
    useStockValidation, 
    useDrafts, 
    useDraftSync,
    type SyncDraft 
} from '@/features/pos/hooks'
import { type CheckoutResponse } from '@/features/sales/types'
import type { Customer, Product, WizardState } from '@/types/pos'
import type { TransactionData } from '@/types/transactions'
import { type DraftCart } from './DraftCartsList'
import type { CheckoutWizardState } from '@/features/sales/components/checkout/SalesCheckoutWizardContent'

// UI Components from Feature
import { SearchBar, CategoryFilter, ProductGrid, Cart, POSCheckoutHeader, POSLayoutSkeleton } from '@/features/pos/components'
import { SalesCheckoutWizardContent } from '@/features/sales/components/checkout/SalesCheckoutWizardContent'

// Shared components
import { SessionControl, SessionControlHandle } from '@/features/pos/components/SessionControl'
import { ScannerFeedback, ScannerFeedbackHandle } from '@/features/pos/components/ScannerFeedback'
import { PricingUtils } from '@/features/inventory/utils/pricing'
import { SalesOrdersModal } from '@/features/pos/components/SalesOrdersModal'
import { AdvancedContactSelector } from '@/components/selectors/AdvancedContactSelector'
import { Label } from '@/components/ui/label'
import { useTouchMode } from '@/hooks/useTouchMode'

// Lazy-loaded components
const POSVariantSelectorModal = dynamic(
    () => import('@/features/pos/components/POSVariantSelectorModal').then(mod => ({ default: mod.POSVariantSelectorModal })),
    { ssr: false }
)

const DraftCartsList = dynamic(
    () => import('@/features/pos/components/DraftCartsList').then(mod => ({ default: mod.DraftCartsList })),
    { ssr: false }
)

const NumpadModal = dynamic(
    () => import('@/features/pos/components/NumpadModal').then(mod => ({ default: mod.NumpadModal })),
    { ssr: false }
)

export function POSClientView() {
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
        posMode,
        setPosMode,
    } = usePOS()

    const { isTouchMode, toggleTouchMode } = useTouchMode()


    const { user } = useAuth()
    
    // Stable onStateChange for the wizard to break feedback loops
    const handleWizardStateChange = useCallback((state: any) => {
        setWizardState(state)
    }, [setWizardState])

    const { addProductToCart, updateQuantity, removeFromCart, clearCart, canCheckout, fetchEffectivePrice } = useCart()
    const { limits: stockLimits, calculateMaxQty } = useStockValidation()

    // ── Real-time Sync ──────────────────────────────────────────
    const handleNewDraft = useCallback((draft: SyncDraft) => {
        toast.info(`Nuevo borrador creado`, {
            description: `"${draft.name}" por ${draft.created_by_full_name || 'otro usuario'}`,
            duration: 4000,
        })
    }, [])

    const handleDraftDeleted = useCallback((_draftId: number) => {
        // Silently refresh — the list will update via sync
    }, [])

    const { syncDrafts, acquireLock, releaseLock, isLockedByOther, getLockInfo, forceSync, browserSessionKey } = useDraftSync({
        posSessionId: (currentSession?.id ?? null) as number | null,
        enabled: !!currentSession?.id,
        onNewDraft: handleNewDraft,
        onDraftUpdated: (draft) => { /* Optional: handle quiet updates */ },
        onSessionStateChange: (status, closedBy) => {
            if (status === 'CLOSED') {
                toast.error("Sesión Cerrada", {
                    description: `La sesión ha sido cerrada por ${closedBy || 'otro terminal'}.`,
                    duration: 10000, // 10 seconds, enough to see it
                })
                // Update local session state to null to trigger clean UI reset
                setCurrentSession(null)
            }
        }
    })

    const { saveDraft, loadDraft, drafts, isSaving, lastSaved, fetchDrafts, releaseCurrentLock } = useDrafts({
        browserSessionKey,
        acquireLock,
        releaseLock,
        forceSync,
    })

    const [isWithdrawing, setIsWithdrawing] = useState(false)
    const [withdrawDialogOpen, setWithdrawDialogOpen] = useState(false)
    const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null)
    const [selectedPartnerName, setSelectedPartnerName] = useState<string>("")

    const posContentRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({
        contentRef: posContentRef,
        documentTitle: 'Ticket de Venta',
    })
    const { filteredProducts, categories, searchTerm, setSearchTerm, selectedCategoryId, setSelectedCategoryId, refreshProducts, toggleFavorite } = useProducts()

    const [completedSaleData, setCompletedSaleData] = useState<TransactionData | null>(null)

    useEffect(() => { if (lastSaved) refreshProducts(true) }, [lastSaved, refreshProducts])

    const sessionControlRef = useRef<SessionControlHandle>(null)
    const scannerFeedbackRef = useRef<ScannerFeedbackHandle>(null)
    const queryClient = useQueryClient()
    const searchParams = useSearchParams()

    const [draftsListOpen, setDraftsListOpen] = useState(false)
    const [variantModalOpen, setVariantModalOpen] = useState(false)
    const [selectedProductForVariant, setSelectedProductForVariant] = useState<Product | null>(null)
    const [numpadOpen, setNumpadOpen] = useState(false)
    const [numpadConfig, setNumpadConfig] = useState<{ itemId: string, field: 'qty' | 'price' | 'discount', initialValue: number } | null>(null)
    const [numpadValue, setNumpadValue] = useState("0")
    const [ordersModalOpen, setOrdersModalOpen] = useState(false)
    const [isSharedSession, setIsSharedSession] = useState(false)
    const draftLoadedFromUrl = useRef(false)

    const currentOrderLines = useMemo(() => items.map(item => ({
        product: item.id,
        product_name: item.name,
        description: item.name,
        quantity: item.qty,
        uom: item.uom || 0,
        uom_name: item.uom_name,
        unit_price: item.unit_price_gross,
        unit_price_net: item.unit_price_net,
        unit_price_gross: item.unit_price_gross,
        tax_rate: (item as any).tax_rate || 19,
        discount_amount: item.discount_amount,
        discount_percentage: item.discount_percentage,
        product_type: item.product_type,
        requires_advanced_manufacturing: item.requires_advanced_manufacturing,
        manufacturing_data: item.manufacturing_data,
        code: item.code,
        internal_code: item.internal_code,
    })), [items])

    useEffect(() => {
        if (typeof window !== 'undefined') {
            requestAnimationFrame(() => setIsSharedSession(!!localStorage.getItem('shared_pos_session_id')))
        }
    }, [currentSession])

    useEffect(() => {
        const dIdStr = searchParams.get('draftId')
        if (dIdStr && currentSession?.id && !loading && !draftLoadedFromUrl.current) {
            const dId = parseInt(dIdStr); if (!isNaN(dId)) {
                draftLoadedFromUrl.current = true
                setTimeout(() => loadDraft(dId).then(() => setPosMode('CHECKOUT')), 500)
            }
        }
    }, [searchParams, currentSession?.id, loading, loadDraft])

    useEffect(() => {
        if (!currentSession?.id || items.length === 0 || loading || wizardState?.isLoading) return
        const timer = setTimeout(() => saveDraft(undefined, true), 2000)
        return () => clearTimeout(timer)
    }, [items, selectedCustomerId, wizardState, currentSession, loading])

    // 5. Sync selected customer FROM wizard state TO POS context
    useEffect(() => {
        const wCustId = wizardState?.selectedCustomerId
        if (wCustId && wCustId.toString() !== selectedCustomerId?.toString()) {
            const parsed = parseInt(wCustId.toString());
            if (!isNaN(parsed) && parsed !== selectedCustomerId) {
                // Use rAF to decouple state updates
                requestAnimationFrame(() => {
                    if (parsed !== selectedCustomerId) {
                        setSelectedCustomerId(parsed)
                    }
                })
            }
        }
    }, [wizardState?.selectedCustomerId, selectedCustomerId, setSelectedCustomerId])

    const handleProductClick = (product: Product) => {
        if (product.has_variants && (product.variants_count || 0) > 0) {
            setSelectedProductForVariant(product); setVariantModalOpen(true)
        } else addProductToCart(product)
    }

    const handleSearchEnter = () => {
        const term = searchTerm.toLowerCase().trim()
        if (!term) return
        const exact = filteredProducts.find(p => p.code.toLowerCase() === term || p.internal_code?.toLowerCase() === term)
        if (exact) { handleProductClick(exact); setSearchTerm(""); return }
        if (filteredProducts.length === 1) { handleProductClick(filteredProducts[0]); setSearchTerm(""); return }
        scannerFeedbackRef.current?.triggerError()
    }

    const handleOpenNumpad = (itemId: string, field: 'qty' | 'price' | 'discount', currentVal: number) => {
        setNumpadConfig({ itemId, field, initialValue: currentVal }); setNumpadValue(currentVal.toString()); setNumpadOpen(true)
    }

    const handleNumpadConfirm = (value: number) => {
        if (!numpadConfig) return
        if (numpadConfig.itemId === 'cart') { if (numpadConfig.field === 'discount') setTotalDiscountAmount(value) }
        else {
            if (numpadConfig.field === 'qty') updateQuantity(numpadConfig.itemId, value)
            else if (numpadConfig.field === 'price') handleItemPriceChange(numpadConfig.itemId, value)
            else if (numpadConfig.field === 'discount') {
                const item = items.find(i => i.cartItemId === numpadConfig.itemId)
                if (item) {
                    const totalBefore = item.qty * item.unit_price_gross
                    const percent = totalBefore > 0 ? (value / totalBefore) * 100 : 0
                    handleItemDiscountChange(numpadConfig.itemId, value, percent)
                }
            }
        }
        setNumpadOpen(false)
    }

    const handleItemUomChange = async (itemId: string, uomId: number, uomName: string) => {
        const item = items.find(i => i.cartItemId === itemId); if (!item) return
        const prices = await fetchEffectivePrice(item, item.qty, uomId)
        updateItem(itemId, { uom: uomId, uom_name: uomName, unit_price_net: prices.net, unit_price_gross: prices.gross, total_net: PricingUtils.calculateLineNet(item.qty, prices.net), total_gross: Math.round(item.qty * prices.gross) })
    }

    const handleItemPriceChange = (itemId: string, priceGross: number) => {
        const item = items.find(i => i.cartItemId === itemId); if (!item) return
        const linePricing = PricingUtils.calculateLineFromGross(item.qty, priceGross, item.discount_amount || 0)
        updateItem(itemId, { unit_price_net: PricingUtils.grossToNet(priceGross), unit_price_gross: priceGross, total_net: linePricing.net, total_gross: linePricing.gross })
    }

    const handleItemDiscountChange = (itemId: string, amount: number, percent: number) => {
        const item = items.find(i => i.cartItemId === itemId); if (!item) return
        const linePricing = PricingUtils.calculateLineFromGross(item.qty, item.unit_price_gross, amount)
        updateItem(itemId, { discount_amount: amount, discount_percentage: percent, total_net: linePricing.net, total_gross: linePricing.gross })
    }

    const handleConfirmSale = async () => {
        const check = canCheckout(); if (!check.valid) { toast.error(check.error); return }
        
        // Pre-save draft if it doesn't exist yet to avoid the "flash" when auto-save assigns an ID later
        if (!currentDraftId) {
            await saveDraft(undefined, true)
        }
        
        setWizardState({ step: 1, isQuickSale: false }); setPosMode('CHECKOUT')
    }

    const handleWithdraw = async () => {
        if (!currentDraftId) {
            toast.error("Guarde el carrito como borrador primero o espere a la sincronización automática.")
            return
        }

        if (!selectedPartnerId) {
            toast.error("Debe seleccionar un socio para realizar el retiro.")
            return
        }

        setIsWithdrawing(true)
        try {
            const res = await api.post(`/sales/pos-drafts/${currentDraftId}/withdraw/`, {
                pos_session_id: currentSession?.id,
                partner_id: selectedPartnerId
            })

            toast.success(res.data.message || "Retiro procesado exitosamente")
            setWithdrawDialogOpen(false)
            setSelectedPartnerId(null)
            setSelectedPartnerName("")

            // Cleanup POS state
            await releaseCurrentLock()
            setCurrentDraftId(null)
            setWizardState(null)
            clearCart()
            await fetchDrafts()
            forceSync()
            setPosMode('SHOPPING')
        } catch (error: unknown) {
            const msg = getErrorMessage(error) || "Error al procesar el retiro"
            toast.error(msg)
        } finally {
            setIsWithdrawing(false)
        }
    }

    const handleLoadDraft = async (draft: SyncDraft | DraftCart) => {
        await loadDraft(draft.id); setDraftsListOpen(false)
        if ('wizard_state' in draft && draft.wizard_state?.step) setPosMode('CHECKOUT')
    }

    const handleCheckoutComplete = async (resData: TransactionData | CheckoutResponse) => {
        // Map CheckoutResponse to TransactionData if needed, or just cast if they overlap in usage
        const transactionData = resData as TransactionData
        setCompletedSaleData(transactionData)
        await releaseCurrentLock()
        setCurrentDraftId(null); setWizardState(null); clearCart()
        await fetchDrafts(); queryClient.invalidateQueries({ queryKey: ['sales'] })
        forceSync()
        setPosMode('SHOPPING'); toast.success("Venta completada exitosamente")
    }

    const handleSuspendDraft = async (finalState: CheckoutWizardState) => {
        try {
            await saveDraft(undefined, true, finalState as unknown as Record<string, unknown>)
        } catch (error) {
            console.error("Failed to suspend draft", error)
        }
        await releaseCurrentLock()
        setCurrentDraftId(null)
        setWizardState(null)
        clearCart()
        await fetchDrafts()
        forceSync()
        setPosMode('SHOPPING')
        toast.success("Borrador liberado y listo para pago")
    }

    const handleQuickSale = async () => {
        const check = Validation.canQuickSale(items, selectedCustomerId); if (!check.allowed) { toast.error(check.reason); return }
        
        // Pre-save draft to stabilize ID before entering checkout flow
        if (!currentDraftId) {
            await saveDraft(undefined, true)
        }
        
        if (!selectedCustomerId && defaultCustomerId) setSelectedCustomerId(defaultCustomerId)
        const isOnlyService = items.every(line => line.product_type === 'SERVICE')
        const hasMfg = items.some(line => line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing)
        const lastStep = (isOnlyService ? 3 : 4) + (hasMfg ? 1 : 0)
        setWizardState({ step: lastStep, isQuickSale: true, dteData: { type: 'BOLETA', number: '', date: new Date().toISOString().split('T')[0], attachment: null, isPending: false }, deliveryData: { type: 'IMMEDIATE', date: null, notes: '' } } as any)
        setTimeout(() => setPosMode('CHECKOUT'), 0)
    }

    const quickSaleEligibility = Validation.canQuickSale(items, selectedCustomerId)

    if (loading) return <POSLayoutSkeleton />

    return (
        <div className="flex-1 p-4 pt-2 flex flex-col gap-2 overflow-hidden animate-in fade-in duration-500">
            <div className="flex items-center justify-between py-1 px-1 mb-2 relative min-h-[56px] border-b pb-2">
                {/* Left: Terminal & Session Info */}
                <div className="flex items-center gap-4 flex-1">
                    <h2 className="text-xl font-bold tracking-tight">
                        {currentSession?.terminal_name || "Punto de Venta"}
                    </h2>
                    {currentSession?.status === 'OPEN' && (
                        <div className="hidden sm:flex items-center gap-2">
                            <span className="border border-primary/20 bg-primary/5 text-primary tracking-widest px-2 py-0.5 text-[10px] h-6 font-bold uppercase transition-colors rounded-sm">
                                Sesión #{currentSession.id}
                            </span>
                            <span className="border border-success/30 bg-success/5 text-success px-2 py-0.5 text-[10px] h-6 font-medium uppercase rounded-sm">
                                {user?.first_name} {user?.last_name}
                            </span>
                        </div>
                    )}
                </div>

                {/* Middle: Steps Header */}
                <div className="flex-1 flex justify-center px-4">
                    <div className="w-full max-w-2xl">
                        <POSCheckoutHeader />
                    </div>
                </div>

                {/* Right: Actions & Menu */}
                <div className="flex items-center gap-2 flex-1 justify-end">
                    {(() => {
                        const isOnlyService = items.every(line => line.product_type === 'SERVICE')
                        const hasMfg = items.some(line => line.product_type === 'MANUFACTURABLE' && line.requires_advanced_manufacturing)
                        const totalSteps = (isOnlyService ? 3 : 4) + (hasMfg ? 1 : 0)
                        const isPaymentStep = wizardState?.step === totalSteps

                        // Prioritize current draft in quick view
                        const quickDrafts = [...syncDrafts].slice(0, 5)
                        if (currentDraftId && !quickDrafts.find(d => d.id === currentDraftId)) {
                            const current = syncDrafts.find(d => d.id === currentDraftId)
                            if (current) {
                                quickDrafts.unshift(current)
                                quickDrafts.pop()
                            }
                        }

                        return syncDrafts.length > 0 && (
                            <div className="hidden lg:flex items-center gap-1 mr-2 animate-in fade-in zoom-in duration-300">
                                {quickDrafts.map(d => {
                                    const lockInfo = getLockInfo(d.id)
                                    const lockedByOther = lockInfo.isLocked && !lockInfo.isOwnLock
                                    const isWaitingPayment = !!d.wizard_state?.isWaitingPayment;
                                    return (
                                        <Button
                                            key={d.id}
                                            variant="outline"
                                            size="sm"
                                            className={cn(
                                                "h-10 min-w-[40px] px-3 text-[10px] font-mono font-bold transition-all duration-300 gap-1.5 relative rounded-sm",
                                                currentDraftId === d.id ? "bg-primary/5 border-primary text-primary shadow-sm border-solid ring-1 ring-primary/20" : "border-dashed text-muted-foreground",
                                                isSaving && currentDraftId === d.id && "animate-pulse opacity-70",
                                                lockedByOther && "border-destructive/40 opacity-60",
                                                isWaitingPayment && currentDraftId !== d.id && "border-warning text-warning bg-warning/10 shadow-sm border-solid ring-1 ring-warning/30 animate-in zoom-in-95 duration-500"
                                            )}
                                            onClick={() => handleLoadDraft(d)}
                                            title={lockedByOther ? `En uso por ${lockInfo.lockedByName}` : isWaitingPayment ? "Registrar Pago (Pendiente)" : undefined}
                                        >
                                            {lockedByOther && <Lock className="mr-0.5 h-2.5 w-2.5 text-destructive" />}
                                            {isWaitingPayment && currentDraftId !== d.id && !lockedByOther ? (
                                                <div className="flex items-center gap-1">
                                                    {d.id}
                                                    <Wallet className="h-3.5 w-3.5 text-warning animate-pulse" />
                                                </div>
                                            ) : (
                                                (!isWaitingPayment || currentDraftId === d.id) && d.id
                                            )}
                                            {isSaving && currentDraftId === d.id && <Loader2 className="ml-1 h-2 w-2 animate-spin" />}
                                        </Button>
                                    )
                                })}
                                {currentDraftId === null && items.length > 0 && (
                                    <span className="h-10 border border-dashed border-muted-foreground/30 text-[9px] px-3 opacity-50 bg-muted/20 flex items-center justify-center rounded-sm text-muted-foreground uppercase font-bold tracking-widest">
                                        Nuevo...
                                    </span>
                                )}
                            </div>
                        )
                    })()}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="gap-2 h-10 px-4">
                                <LayoutGrid className="h-4 w-4" />
                                <span className="hidden sm:inline">Menú</span>
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuCheckboxItem checked={isTouchMode} onCheckedChange={toggleTouchMode}>
                                Modo Táctil (Numpad)
                            </DropdownMenuCheckboxItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setDraftsListOpen(true)}><Save className="mr-2 h-4 w-4" />Ver Borradores</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => sessionControlRef.current?.showXReport()}><BarChart3 className="mr-2 h-4 w-4" />Reporte Parcial</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setOrdersModalOpen(true)}><FileText className="mr-2 h-4 w-4" />Notas de Venta</DropdownMenuItem>

                            {/* Partner Withdrawal Option */}
                            {items.length > 0 && (
                                <DropdownMenuItem
                                    onClick={() => setWithdrawDialogOpen(true)}
                                    disabled={items.some(i => !i.track_inventory)}
                                    className="font-bold text-warning focus:text-warning"
                                >
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Retiro de Socio
                                </DropdownMenuItem>
                            )}

                            {currentSession?.status === 'OPEN' && (
                                <>
                                    <DropdownMenuItem onClick={() => sessionControlRef.current?.showMoveDialog()}><ArrowRightLeft className="mr-2 h-4 w-4" />Movimiento de Caja</DropdownMenuItem>
                                    <DropdownMenuItem onClick={() => sessionControlRef.current?.requestCloseSession()} className="text-destructive focus:text-destructive">
                                        <Lock className="mr-2 h-4 w-4" />
                                        Cerrar Caja
                                    </DropdownMenuItem>
                                </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => window.location.href = '/'} className="text-primary font-bold">
                                <LogOut className="mr-2 h-4 w-4 rotate-180" />
                                Volver al ERP
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <SessionControl ref={sessionControlRef} onSessionChange={setCurrentSession} session={currentSession ?? undefined} hideSessionInfo />
                </div>
            </div>

            <div className="relative grid grid-cols-1 md:grid-cols-12 gap-4 flex-1 min-h-0 overflow-hidden">
                {currentSession !== undefined && currentSession === null && (
                    <div className="absolute inset-0 z-30 bg-background/60 backdrop-blur-[2px] flex items-center justify-center">
                        <Card className="w-full max-w-md shadow-sm border-primary/20 p-8 text-center space-y-4 rounded-md">
                            <Lock className="h-12 w-12 text-primary mx-auto mb-2" />
                            <h3 className="text-2xl font-bold">Caja Cerrada</h3>
                            <p className="text-muted-foreground">Debe abrir una sesión de caja para realizar ventas.</p>
                            <SessionControl onSessionChange={setCurrentSession} session={currentSession ?? undefined} />
                        </Card>
                    </div>
                )}

                <div className="md:col-span-12 lg:col-span-7 flex flex-col min-h-0">
                    <AnimatePresence mode="wait">
                        {posMode === 'SHOPPING' ? (
                            <motion.div key="shop" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, scale: 0.98 }} className="flex-1 flex flex-col min-h-0">
                                <Card className="flex-1 flex flex-col overflow-hidden bg-muted/10 border">
                                    <div className="p-4 border-b bg-background/50 space-y-4">
                                        <SearchBar value={searchTerm} onChange={setSearchTerm} onEnter={handleSearchEnter} />
                                        <CategoryFilter categories={categories} selectedCategoryId={selectedCategoryId} onSelectCategory={setSelectedCategoryId} />
                                    </div>
                                    <div className="flex-1 p-4"><ProductGrid products={filteredProducts} categories={categories} limits={stockLimits} onProductClick={handleProductClick} onToggleFavorite={toggleFavorite} /></div>
                                </Card>
                            </motion.div>
                        ) : (
                            <motion.div key={currentDraftId || 'checkout-new'} initial={{ opacity: 0, scale: 0.98, x: 20 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="flex-1 flex flex-col min-h-0 bg-background border rounded-md shadow-sm overflow-hidden relative border-primary/20">
                                <SalesCheckoutWizardContent
                                    key={currentDraftId || 'checkout-new'}
                                    order={null}
                                    orderLines={currentOrderLines as any}
                                    total={totals.total_gross}
                                    totalDiscountAmount={totalDiscountAmount}
                                    onComplete={(data) => handleCheckoutComplete(data as any)}
                                    onCancel={() => setPosMode('SHOPPING')}
                                    onSuspend={(state) => handleSuspendDraft(state as any)}
                                    initialCustomerId={selectedCustomerId?.toString() || (wizardState?.isQuickSale ? defaultCustomerId?.toString() : undefined)}
                                    posSessionId={currentSession?.id}
                                    terminalId={currentSession?.terminal}
                                    terminalDeviceId={currentSession?.terminal_details?.payment_terminal_device ?? null}
                                    quickSale={wizardState?.isQuickSale}
                                    initialStep={wizardState?.step}
                                    initialDteData={wizardState?.dteData as any}
                                    initialPaymentData={wizardState?.paymentData as any}
                                    initialDeliveryData={wizardState?.deliveryData as any}
                                    initialApprovalTaskId={wizardState?.approvalTaskId}
                                    initialIsWaitingApproval={wizardState?.isWaitingApproval}
                                    initialIsApproved={wizardState?.isApproved}
                                    initialDraftId={currentDraftId}
                                    onStateChange={handleWizardStateChange}
                                    isInline
                                    isSessionHost={user?.id === currentSession?.user}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="md:col-span-12 lg:col-span-5 flex flex-col min-h-0">
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
                        posMode={posMode}
                        wizardState={wizardState}
                    />
                </div>
            </div>

            <POSVariantSelectorModal open={variantModalOpen} onOpenChange={setVariantModalOpen} product={selectedProductForVariant} onSelect={v => addProductToCart(v as any)} items={items} bomCache={bomCache as any} componentCache={componentCache as any} calculateMaxQty={calculateMaxQty} />
            <DraftCartsList open={draftsListOpen} onOpenChange={setDraftsListOpen} posSessionId={currentSession?.id || null} onLoadDraft={handleLoadDraft} showTrigger={false} syncDrafts={syncDrafts as any} getLockInfo={getLockInfo} />
            <NumpadModal open={numpadOpen} onOpenChange={setNumpadOpen} title={numpadConfig?.field === 'qty' ? "Cantidad" : "Precio"} value={numpadValue} onChange={setNumpadValue} onConfirm={() => handleNumpadConfirm(parseFloat(numpadValue))} allowDecimal />
            <ScannerFeedback ref={scannerFeedbackRef} />
            <SalesOrdersModal open={ordersModalOpen} onOpenChange={setOrdersModalOpen} posSessionId={currentSession?.id} />

            <AlertDialog open={!!completedSaleData} onOpenChange={(open) => { if (!open) setCompletedSaleData(null) }}>
                <AlertDialogContent className="max-w-md bg-card border-primary/10 shadow-sm rounded-lg">
                    <AlertDialogHeader>
                        <div className="mx-auto bg-primary text-primary-foreground p-4 rounded-full mb-4 shadow-sm">
                            <Check className="h-10 w-10 stroke-[3px]" />
                        </div>
                        <AlertDialogTitle className="text-xl font-black tracking-tight text-center text-foreground">¡Venta Exitosa!</AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-primary/60 font-medium">
                            La venta se ha procesado correctamente. ¿Desea imprimir el comprobante térmico?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-4">
                        <Button
                            className="flex-1 h-14 rounded-md text-lg font-black uppercase tracking-widest bg-primary hover:bg-primary/90 shadow-sm group"
                            onClick={() => {
                                handlePrint();
                                setCompletedSaleData(null);
                            }}
                        >
                            <Printer className="mr-3 h-5 w-5 group-hover:scale-110 transition-transform" />
                            Imprimir
                        </Button>
                        <AlertDialogCancel
                            className="flex-1 h-14 border-primary/20 text-primary hover:bg-primary/5 rounded-md text-lg font-bold"
                            onClick={() => setCompletedSaleData(null)}
                        >
                            Cerrar
                        </AlertDialogCancel>
                    </AlertDialogFooter>

                    {/* Hidden Receipt for Printing */}
                    {completedSaleData && (
                        <PrintableReceipt
                            ref={posContentRef}
                            data={{
                                ...(completedSaleData.sale_order_detail as TransactionData || completedSaleData),
                                terminal_name: currentSession?.terminal_name
                            }}
                            currentType={completedSaleData.sale_order_detail ? "sale_order" : "invoice"}
                            mainTitle="Ticket de Venta"
                            subTitle={(completedSaleData as any)?.client_name || "Cliente Contado"}
                        />
                    )}
                </AlertDialogContent>
            </AlertDialog>

            {/* Partner Withdrawal Confirmation */}
            <AlertDialog open={withdrawDialogOpen} onOpenChange={setWithdrawDialogOpen}>
                <AlertDialogContent className="max-w-md bg-card border-warning/10 shadow-sm rounded-lg">
                    <AlertDialogHeader>
                        <div className="mx-auto bg-warning/10 text-warning p-4 rounded-full mb-4 border border-warning/20">
                            <ShoppingCart className="h-8 w-8" />
                        </div>
                        <AlertDialogTitle className="text-xl font-black tracking-tight text-center text-warning">Confirmar Retiro de Socio</AlertDialogTitle>
                        <AlertDialogDescription className="text-center text-warning/60 font-medium pt-2 text-sm">
                            Se registrará un retiro de stock por concepto de <strong>Retiro de Utilidades</strong>.
                            <br />
                            Esta acción descontará el inventario inmediatamente y no genera factura ni boleta.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="space-y-4 my-2">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-warning/50 tracking-widest pl-1">Seleccionar Socio</Label>
                            <AdvancedContactSelector
                                value={selectedPartnerId}
                                onChange={setSelectedPartnerId}
                                onSelectContact={(c) => setSelectedPartnerName(c.name)}
                                isPartnerOnly={true}
                                placeholder="Buscar socio..."
                            />
                        </div>


                    </div>

                    <AlertDialogFooter className="flex-col sm:flex-row gap-3 mt-2">
                        <Button
                            className="flex-1 h-12 rounded-md text-sm font-bold uppercase tracking-wider bg-warning hover:bg-warning shadow-sm disabled:opacity-50"
                            onClick={handleWithdraw}
                            disabled={isWithdrawing || !selectedPartnerId}
                        >
                            {isWithdrawing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                            Confirmar Retiro
                        </Button>
                        <AlertDialogCancel
                            className="flex-1 h-12 border-warning/20 text-warning hover:bg-warning/10 rounded-md text-sm font-bold"
                            disabled={isWithdrawing}
                        >
                            Cancelar
                        </AlertDialogCancel>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
