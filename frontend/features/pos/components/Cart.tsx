"use client"

// Cart Component
// Shopping cart display with totals and actions

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

import {ShoppingCart, Zap, ChevronLeft, ChevronRight, Check, Repeat, MoreVertical, Percent} from 'lucide-react'
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { CartItem } from './CartItem'
import { formatCurrency } from "@/lib/money"
import { useVatRate } from '@/hooks/useVatRate'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import { useTouchMode } from '@/hooks/useTouchMode'
import type { CartItem as CartItemType, Product, UoM, StockLimits } from '../types'
import { useSalesSettings } from '@/features/settings'

export interface PaymentDisplayItem {
    method: string
    amount: number
}

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
    saving?: boolean
    canQuickSale: { allowed: boolean, reason: string }
    onItemQuantityChange: (cartItemId: string, qty: number | string) => void
    onItemUomChange: (cartItemId: string, uomId: number, uomName: string) => void
    onItemPriceChange: (cartItemId: string, priceGross: number) => void
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
    payments?: PaymentDisplayItem[]
}

export function Cart({
    items,
    products,
    uoms,
    limits,
    totals,
    loading,
    saving,
    canQuickSale,
    onItemQuantityChange,
    onItemUomChange,
    onItemPriceChange,
    onItemRemove,
    onOpenNumpad,
    onQuickSale,
    onWithdrawClick,
    onConfirmSale,
    totalDiscountAmount = 0,
    posMode = 'SHOPPING',
    onCheckoutBack,
    onCheckoutNext,
    onCheckoutFinish,
    onCancel,
    onSuspend,
    isLastStep = false,
    checkoutLoading = false,
}: CartProps) {
    const { rate } = useVatRate()
    const { isTouchPOS } = useDeviceContext()
    const { isTouchMode } = useTouchMode()
    const { canApplyLineDiscount, canApplyGlobalDiscount } = useSalesSettings()

    const showLineDiscounts = canApplyLineDiscount
    const showTotalDiscounts = canApplyGlobalDiscount

    return (
        <div className="flex flex-col flex-1 min-h-0 gap-2">
            <Card className="flex-1 flex flex-col overflow-hidden border border-border/60 bg-card dot-grid-surface shadow-lg shadow-black/10 rounded-lg p-2 flex-shrink-0">
                <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                    {/* Header */}
                    <div className={cn("px-2 border-b border-border/40 bg-transparent shrink-0 flex justify-between items-center gap-2", isTouchPOS ? "pb-2 mb-2" : "pb-1.5 mb-1.5")}>
                        <span className="font-bold text-lg tracking-tight whitespace-nowrap">Resumen de Venta</span>
                        <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors rounded-md border-none shadow-none shrink-0",
                                            isTouchMode ? "h-10 w-10" : "h-7 w-7"
                                        )}
                                        type="button"
                                    >
                                        <MoreVertical className={cn(isTouchMode ? "h-5 w-5" : "h-4 w-4")} />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                    {showTotalDiscounts && (
                                        <DropdownMenuItem
                                            onClick={() => onOpenNumpad('cart', 'discount', totalDiscountAmount || 0)}
                                            className="cursor-pointer gap-2"
                                        >
                                            <Percent className="h-4 w-4" />
                                            <span>Descuento Global</span>
                                            {totalDiscountAmount > 0 && (
                                                <span className="ml-auto text-destructive font-bold text-xs">-{formatCurrency(totalDiscountAmount)}</span>
                                            )}
                                        </DropdownMenuItem>
                                    )}
                                </DropdownMenuContent>
                            </DropdownMenu>
                    </div>

                    {/* Items List */}
                    <div className="flex-1 overflow-auto bg-transparent rounded-b-md relative scrollbar-thin">
                        {items.length === 0 ? (
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

                    {/* Footer — Mini Boletín */}
                    <div className="bg-card shrink-0 pt-2 mt-2 border-t border-border/40">
                        <div className="rounded-md bg-muted/50 p-2.5 space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>Subtotal Neto</span>
                                <span>{formatCurrency(totals.total_net)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>IVA ({rate}%)</span>
                                <span>{formatCurrency(totals.total_tax)}</span>
                            </div>

                            {(totals.line_discount_total || 0) > 0 && (
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Descuentos por Línea</span>
                                    <span>-{formatCurrency(totals.line_discount_total || 0)}</span>
                                </div>
                            )}

                            {(totals.global_discount_total || 0) > 0 && (
                                <div className="flex justify-between text-xs text-muted-foreground">
                                    <span>Descuento Global</span>
                                    <span>-{formatCurrency(totalDiscountAmount || totals.global_discount_total || 0)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-lg font-bold pt-1.5 border-t">
                                <span>Total</span>
                                <span>{formatCurrency(totals.total_gross)}</span>
                            </div>
                            </div>
                        </div>
                </CardContent>
            </Card>

            {/* Floating Action Buttons */}
            <div className="bg-card dot-grid-surface border border-border/60 rounded-lg shadow-lg shadow-black/10 p-2 space-y-2">
                {posMode === 'SHOPPING' && (
                    <>
                        <div className="flex gap-2">
                            <Button
                                className={cn(
                                    "flex-1 shrink rounded-sm font-black uppercase tracking-tight shadow-card border-none bg-magenta hover:bg-magenta/90 text-white",
                                    isTouchPOS ? "h-16 text-xl" : "h-11 text-base"
                                )}
                                size="lg"
                                disabled={loading || items.length === 0 || !canQuickSale.allowed}
                                onClick={onQuickSale}
                                title={!canQuickSale.allowed ? canQuickSale.reason : "Venta rápida: Saltar directo a pago con BOLETA"}
                            >
                                <Zap className={cn("mr-2 rounded-sm", isTouchPOS ? "h-6 w-6" : "h-5 w-5")} />
                                {!canQuickSale.allowed ? canQuickSale.reason : "Venta Rápida"}
                            </Button>
                            {onWithdrawClick && items.length > 0 && items.every(i => i.track_inventory) && (
                                <Button
                                    className={cn(
                                        "flex-1 shrink rounded-sm font-black uppercase tracking-tight shadow-card border-none bg-yellow hover:bg-yellow/90 text-black",
                                        isTouchPOS ? "h-16 text-xl" : "h-11 text-base"
                                    )}
                                    size="lg"
                                    onClick={onWithdrawClick}
                                >
                                    <ShoppingCart className={cn("mr-2 rounded-sm", isTouchPOS ? "h-6 w-6" : "h-5 w-5")} />
                                    Retiro de Socio
                                </Button>
                            )}
                        </div>

                        <Button
                            id="confirm-sale-btn"
                            className={cn(
                                "w-full rounded-sm font-black uppercase tracking-tight shadow-card border-none bg-cyan hover:bg-cyan/90 text-white",
                                isTouchPOS ? "h-16 text-xl" : "h-11 text-base"
                            )}
                            size="lg"
                            disabled={loading || saving || items.length === 0}
                            onClick={onConfirmSale}
                        >
                            <ShoppingCart className={cn(
                                "mr-2 rounded-sm",
                                isTouchPOS ? "h-6 w-6" : "h-5 w-5"
                            )} />
                            {loading || saving ? "Procesando..." : "Confirmar Venta"}
                        </Button>
                    </>
                )}

                {posMode === 'CHECKOUT' && (
                    <>
                        <div className="flex gap-2">
                            <Button
                                className={cn(
                                    "flex-1 shrink rounded-sm font-black uppercase tracking-tight shadow-card border-none bg-magenta hover:bg-magenta/90 text-white",
                                    isTouchPOS ? "h-16 text-xl" : "h-11 text-base"
                                )}
                                size="lg"
                                onClick={onCancel}
                                disabled={checkoutLoading}
                            >
                                <ShoppingCart className={cn("mr-2 rounded-sm", isTouchPOS ? "h-6 w-6" : "h-5 w-5")} />
                                Volver al Carrito
                            </Button>
                            {isLastStep && (
                                <Button
                                    className={cn(
                                        "flex-1 shrink rounded-sm font-black uppercase tracking-tight shadow-card border-none bg-yellow hover:bg-yellow/90 text-black",
                                        isTouchPOS ? "h-16 text-xl" : "h-11 text-base"
                                    )}
                                    size="lg"
                                    onClick={onSuspend}
                                    disabled={checkoutLoading}
                                >
                                    <Repeat className={cn("mr-2 rounded-sm", isTouchPOS ? "h-6 w-6" : "h-5 w-5")} />
                                    Pagar en otra sesión
                                </Button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                onClick={onCheckoutBack}
                                disabled={checkoutLoading}
                                className={cn(
                                    "flex-1 shrink rounded-sm font-black uppercase tracking-tight shadow-card border-none bg-cyan hover:bg-cyan/90 text-white",
                                    isTouchPOS ? "h-16 text-xl" : "h-11 text-base"
                                )}
                                size="lg"
                            >
                                <ChevronLeft className={cn("mr-2 rounded-sm", isTouchPOS ? "h-6 w-6" : "h-5 w-5")} />
                                Atrás
                            </Button>
                            {!isLastStep ? (
                                <Button
                                    onClick={onCheckoutNext}
                                    disabled={checkoutLoading}
                                    className={cn(
                                        "flex-1 shrink rounded-sm font-black uppercase tracking-tight shadow-card border-none bg-primary hover:bg-primary/90 text-primary-foreground",
                                        isTouchPOS ? "h-16 text-xl" : "h-11 text-base"
                                    )}
                                    size="lg"
                                >
                                    Siguiente
                                    <ChevronRight className={cn("ml-2 rounded-sm", isTouchPOS ? "h-6 w-6" : "h-5 w-5")} />
                                </Button>
                            ) : (
                                <Button
                                    onClick={onCheckoutFinish}
                                    disabled={checkoutLoading}
                                    className={cn(
                                        "flex-1 shrink rounded-sm font-black uppercase tracking-tight shadow-card border-none bg-primary hover:bg-primary/90 text-primary-foreground",
                                        isTouchPOS ? "h-16 text-xl" : "h-11 text-base"
                                    )}
                                    size="lg"
                                >
                                    <Check className={cn("mr-2 rounded-sm", isTouchPOS ? "h-6 w-6" : "h-5 w-5")} />
                                    Finalizar Venta
                                </Button>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
