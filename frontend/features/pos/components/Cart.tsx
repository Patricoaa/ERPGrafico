"use client"

// Cart Component
// Shopping cart display with totals and actions

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import {ShoppingCart, Zap, Clock, ChevronLeft, ChevronRight, Check} from 'lucide-react'
import { cn, translatePaymentMethod } from '@/lib/utils'
import { CartItem } from './CartItem'
import { formatCurrency } from "@/lib/money"
import { useVatRate } from '@/hooks/useVatRate'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import { useTouchMode } from '@/hooks/useTouchMode'
import type { CartItem as CartItemType, Product, UoM, StockLimits } from '@/types/pos'
import { useSalesSettings } from '@/features/settings'

interface CartProps {
    items: CartItemType[]
    products: Product[]
    uoms: UoM[]
    limits: StockLimits
    totals: {
        total_gross: number
        total_net: number
        total_tax: number
        total_discount?: number
        total_gross_before_discount?: number
        line_discount_total?: number
        global_discount_total?: number
    }
    totalDiscountAmount?: number
    onTotalDiscountChange?: (amount: number) => void
    loading: boolean
    currentDraftId?: number | null
    lastSaved?: Date | null
    saving?: boolean
    canQuickSale: { allowed: boolean, reason: string }
    onItemQuantityChange: (cartItemId: string, qty: number | string) => void
    onItemUomChange: (cartItemId: string, uomId: number, uomName: string) => void
    onItemPriceChange: (cartItemId: string, priceGross: number) => void
    onItemDiscountChange: (cartItemId: string, amount: number, percent: number) => void
    onItemRemove: (cartItemId: string) => void
    onOpenNumpad: (cartItemId: string | 'cart', field: 'qty' | 'price' | 'discount', currentValue: number) => void
    onQuickSale: () => void
    onWithdrawClick?: () => void
    onConfirmSale: () => void
    posMode?: 'SHOPPING' | 'CHECKOUT'
    // Checkout mode navigation
    onCheckoutBack?: () => void
    onCheckoutNext?: () => void | Promise<void>
    onCheckoutFinish?: () => void | Promise<void>
    onCancel?: () => void
    onSuspend?: () => void
    isLastStep?: boolean
    checkoutLoading?: boolean
    paymentMethod?: string | null
    paymentAmount?: number
}

export function Cart({
    items,
    products,
    uoms,
    limits,
    totals,
    loading,
    currentDraftId,
    lastSaved,
    saving,
    canQuickSale,
    onItemQuantityChange,
    onItemUomChange,
    onItemPriceChange,
    onItemDiscountChange,
    onItemRemove,
    onOpenNumpad,
    onQuickSale,
    onWithdrawClick,
    onConfirmSale,
    totalDiscountAmount = 0,
    onTotalDiscountChange,
    posMode = 'SHOPPING',
    onCheckoutBack,
    onCheckoutNext,
    onCheckoutFinish,
    onCancel,
    onSuspend,
    isLastStep = false,
    checkoutLoading = false,
    paymentMethod,
    paymentAmount,
}: CartProps) {
    const { rate } = useVatRate()
    const { isTouchPOS } = useDeviceContext()
    const { isTouchMode } = useTouchMode()
    const { canApplyLineDiscount, canApplyGlobalDiscount } = useSalesSettings()

    const showLineDiscounts = canApplyLineDiscount
    const showTotalDiscounts = canApplyGlobalDiscount

    return (
        <Card className="py-2 flex-1 flex flex-col overflow-hidden border bg-card dot-grid-surface shadow-card rounded-md">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-4 py-1.5 border-b bg-transparent shrink-0">
                    <div className={cn("flex justify-between items-center gap-2", isTouchPOS ? "h-12" : "h-9")}>
                        <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-lg tracking-tight whitespace-nowrap">Resumen de Venta</span>
                            {lastSaved && (
                                <div className="flex items-center text-[9px] text-muted-foreground font-medium gap-1 opacity-80 whitespace-nowrap">
                                    <Clock className="h-2.5 w-2.5" />
                                    <span>
                                        {saving ? "Guardando..." : `Sincronizado: ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                    </span>
                                    {saving && <div className="h-0.5 w-10 bg-primary/20 rounded-full overflow-hidden"><div className="h-full bg-primary animate-progress-buffer w-1/3"></div></div>}
                                </div>
                            )}
                        </div>
                        <span className="text-[10px] font-black bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full uppercase tracking-tighter shrink-0">
                            {items.length} Items
                        </span>
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-auto bg-transparent rounded-b-md relative scrollbar-thin">
                    {items.length === 0 ? (
                        /* Empty State ... */
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-muted-foreground/60 gap-4 animate-in fade-in zoom-in duration-500">
                            <ShoppingCart className="h-12 w-12 text-muted-foreground/20" />
                            <div className="space-y-1.5">
                                <p className="font-bold text-lg text-muted-foreground/80 tracking-tight">El carrito está vacío</p>
                                <p className="max-w-[280px] text-xs italic opacity-70 mx-auto leading-relaxed">
                                    Escanea un código de barras o selecciona productos del catálogo para comenzar la venta.
                                </p>
                            </div>
                        </div>
                    ) : (
                        /* Cards Content */
                        <div className={cn("flex flex-col p-3 bg-card", isTouchMode ? "gap-3" : "gap-2")}>
                            {items.map((item) => {
                                const originalProduct = products.find(p => p.id === item.id)
                                const maxQty = limits[`cart_${item.cartItemId}`]

                                return (
                                    <CartItem
                                        key={item.cartItemId}
                                        item={item}
                                        originalProduct={originalProduct}
                                        uoms={uoms}
                                        maxQty={maxQty}
                                        onQuantityChange={onItemQuantityChange}
                                        onUomChange={onItemUomChange}
                                        onPriceChange={onItemPriceChange}
                                        onDiscountChange={onItemDiscountChange}
                                        onRemove={onItemRemove}
                                        onOpenNumpad={onOpenNumpad}
                                        showLineDiscount={showLineDiscounts}
                                        posMode={posMode}
                                    />
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer — Mini Boletín + Details + Actions */}
                <div className="p-3 bg-card border-t space-y-2">

                    {/* Mini Boletín — Financial Breakdown inside a card */}
                    <div className="rounded-lg bg-muted/50 p-2.5 space-y-1">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Subtotal Neto</span>
                            <span>{formatCurrency(totals.total_net)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>IVA ({rate}%)</span>
                            <span>{formatCurrency(totals.total_tax)}</span>
                        </div>

                        {/* Line Discounts (Sum of all per-item discounts) */}
                        {(totals.line_discount_total || 0) > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Descuentos por Línea</span>
                                <span>-{formatCurrency(totals.line_discount_total || 0)}</span>
                            </div>
                        )}

                        {/* Global Discount (Editable) */}
                        {(showTotalDiscounts || (totals.global_discount_total || 0) > 0) && (
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Descuento Global</span>
                                {showTotalDiscounts ? (
                                    <span
                                        className="cursor-pointer hover:underline underline-offset-2"
                                        onClick={() => onOpenNumpad('cart', 'discount', totalDiscountAmount || 0)}
                                        role="button"
                                        tabIndex={0}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onOpenNumpad('cart', 'discount', totalDiscountAmount || 0); } }}
                                    >
                                        {totalDiscountAmount ? formatCurrency(totalDiscountAmount) : "$0"}
                                    </span>
                                ) : (
                                    <span>-{formatCurrency(totals.global_discount_total || 0)}</span>
                                )}
                            </div>
                        )}

                        <div className="flex justify-between text-lg font-bold pt-1.5 border-t">
                            <span>Total</span>
                            <span>{formatCurrency(totals.total_gross)}</span>
                        </div>

                        {/* Payment Summary — visible on checkout payment step */}
                        {posMode === 'CHECKOUT' && isLastStep && (paymentAmount || 0) > 0 && (
                            <>
                                <div className="border-t my-1.5" />
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Monto Recibido</span>
                                    <span className="font-bold text-foreground">{formatCurrency(paymentAmount || 0)}</span>
                                </div>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Método</span>
                                    <span className="font-bold text-foreground">{translatePaymentMethod(paymentMethod)}</span>
                                </div>
                                {(paymentAmount || 0) !== totals.total_gross && (
                                    <div className="flex justify-between text-xs text-muted-foreground">
                                        <span>{(paymentAmount || 0) > totals.total_gross ? 'Vuelto' : 'Crédito Asignado'}</span>
                                        <span className={cn("font-bold", (paymentAmount || 0) > totals.total_gross ? "text-success" : "text-warning")}>
                                            {formatCurrency(Math.abs((paymentAmount || 0) - totals.total_gross))}
                                        </span>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {posMode === 'SHOPPING' && (
                        /* Quick Sale + Withdraw Row */
                        <div className="flex gap-2">
                            <Button
                                className={cn(
                                    "flex-1 font-black uppercase tracking-tight border border-primary bg-transparent hover:bg-primary/10 relative overflow-hidden transition-colors",
                                    isTouchPOS ? "h-20 text-2xl" : "h-12 text-lg"
                                )}
                                size="lg"
                                disabled={loading || items.length === 0 || !canQuickSale.allowed}
                                onClick={onQuickSale}
                                title={!canQuickSale.allowed ? canQuickSale.reason : "Venta rápida: Saltar directo a pago con BOLETA"}
                            >
                                <Zap className={cn("mr-2", isTouchPOS ? "h-8 w-8" : "h-6 w-6")} />
                                {!canQuickSale.allowed ? canQuickSale.reason : "Venta Rápida"}
                            </Button>
                            {onWithdrawClick && items.length > 0 && items.every(i => i.track_inventory) && (
                                <Button
                                    className={cn(
                                        "flex-1 font-black uppercase tracking-tight bg-warning text-warning-foreground hover:bg-warning/90 shadow-card",
                                        isTouchPOS ? "h-20 text-2xl" : "h-12 text-lg"
                                    )}
                                    size="lg"
                                    onClick={onWithdrawClick}
                                >
                                    <ShoppingCart className={cn("mr-2", isTouchPOS ? "h-8 w-8" : "h-6 w-6")} />
                                    Retiro de Socio
                                </Button>
                            )}
                        </div>
                    )}

                    {posMode === 'SHOPPING' && (
                        /* Confirm Sale Button */
                        <Button
                            id="confirm-sale-btn"
                            className={cn(
                                "w-full font-black uppercase tracking-tight hover:brightness-110 transition-all",
                                    isTouchPOS ? "h-20 text-2xl" : "h-12 text-lg"
                                )}
                                size="lg"
                                disabled={loading || saving || items.length === 0}
                                onClick={onConfirmSale}
                        >
                            <ShoppingCart className={cn(
                                "mr-2",
                                isTouchPOS ? "h-8 w-8" : "h-6 w-6"
                            )} />
                            {loading || saving ? "Procesando..." : "Confirmar Venta"}
                        </Button>
                    )}

                    {posMode === 'CHECKOUT' && (
                        <>
                            {/* Row 1: Volver al Carrito | Pagar en otro terminal */}
                            <div className="flex gap-2">
                                <Button
                                    className={cn(
                                        "flex-1 font-black uppercase tracking-tight border border-primary bg-transparent hover:bg-primary/10 relative overflow-hidden transition-colors",
                                        isTouchPOS ? "h-20 text-2xl" : "h-12 text-lg"
                                    )}
                                    size="lg"
                                    onClick={onCancel}
                                    disabled={checkoutLoading}
                                >
                                    <ShoppingCart className={cn("mr-2", isTouchPOS ? "h-8 w-8" : "h-6 w-6")} />
                                    Volver al Carrito
                                </Button>
                                {isLastStep && (
                                    <Button
                                        className={cn(
                                            "flex-1 font-black uppercase tracking-tight bg-warning text-warning-foreground hover:bg-warning/90 shadow-card",
                                            isTouchPOS ? "h-20 text-2xl" : "h-12 text-lg"
                                        )}
                                        size="lg"
                                        onClick={onSuspend}
                                        disabled={checkoutLoading}
                                    >
                                        Pagar en otro terminal
                                    </Button>
                                )}
                            </div>

                            {/* Row 2: Atrás | Siguiente / Finalizar Venta */}
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    onClick={onCheckoutBack}
                                    disabled={checkoutLoading}
                                    className={cn(
                                        "flex-1 font-black uppercase tracking-tight",
                                        isTouchPOS ? "h-20 text-2xl" : "h-12 text-lg"
                                    )}
                                    size="lg"
                                >
                                    <ChevronLeft className={cn("mr-2", isTouchPOS ? "h-8 w-8" : "h-6 w-6")} />
                                    Atrás
                                </Button>
                                {!isLastStep ? (
                                    <Button
                                        onClick={onCheckoutNext}
                                        disabled={checkoutLoading}
                                        className={cn(
                                            "flex-1 font-black uppercase tracking-tight",
                                            isTouchPOS ? "h-20 text-2xl" : "h-12 text-lg"
                                        )}
                                        size="lg"
                                    >
                                        Siguiente
                                        <ChevronRight className={cn("ml-2", isTouchPOS ? "h-8 w-8" : "h-6 w-6")} />
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={onCheckoutFinish}
                                        disabled={checkoutLoading}
                                        className={cn(
                                            "flex-1 font-black uppercase tracking-tight bg-success hover:bg-success/90 text-success-foreground",
                                            isTouchPOS ? "h-20 text-2xl" : "h-12 text-lg"
                                        )}
                                        size="lg"
                                    >
                                        <Check className={cn("mr-2", isTouchPOS ? "h-8 w-8" : "h-6 w-6")} />
                                        Finalizar Venta
                                    </Button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
