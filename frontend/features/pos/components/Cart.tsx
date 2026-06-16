"use client"
import { formatPlainDate } from "@/lib/utils";

// Cart Component
// Shopping cart display with totals and actions

import { Card, CardContent } from '@/components/ui/card'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import {ShoppingCart, Zap, Clock, User, FileText, Truck, Calendar} from 'lucide-react'
import { cn } from '@/lib/utils'
import { CartItem } from './CartItem'
import { formatCurrency } from "@/lib/money"
import { useDeviceContext } from '@/hooks/useDeviceContext'
import { useTouchMode } from '@/hooks/useTouchMode'
import type { CartItem as CartItemType, Product, UoM, StockLimits, WizardState } from '@/types/pos'
import { useSalesSettings } from '@/features/settings'
import { getDteLabel } from '@/lib/entity-registry'

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
    wizardState?: WizardState | null
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
    wizardState
}: CartProps) {
    const { isTouchPOS } = useDeviceContext()
    const { isTouchMode } = useTouchMode()
    const { canApplyLineDiscount, canApplyGlobalDiscount } = useSalesSettings()

    const showLineDiscounts = canApplyLineDiscount
    const showTotalDiscounts = canApplyGlobalDiscount

    const customerName = wizardState?.selectedCustomerName || "Cliente General"
    const dteType = wizardState?.dteData?.type
    const deliveryType = wizardState?.deliveryData?.type
    const deliveryDate = wizardState?.deliveryData?.date

    const getDeliveryLabel = (type: string) => {
        switch (type) {
            case 'IMMEDIATE': return 'Inmediata'
            case 'PARTIAL': return 'Parcial'
            case 'LATER': return 'Programada'
            default: return type
        }
    }

    return (
        <Card className="py-2 flex-1 flex flex-col overflow-hidden border bg-background/50 shadow-sm rounded-md">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-4 py-1.5 border-b bg-background/50 shrink-0">
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
                        <span className="text-[10px] font-black bg-primary text-primary-foreground px-1.5 py-0.5 rounded-sm uppercase tracking-tighter shrink-0">
                            {items.length} Items
                        </span>
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-auto bg-background/50 rounded-b-md relative scrollbar-thin">
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
                        <div className="flex flex-col gap-2 p-3">
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

                {/* Footer with Totals and Actions */}
                <div className="p-3 bg-muted/20 border-t space-y-3">
                    {/* Sale Metadata Summary (Collapsible Accordion) */}
                    {(wizardState?.selectedCustomerName || dteType || deliveryType) && (
                        <Accordion type="single" collapsible className="border border-border/50 rounded-sm">
                            <AccordionItem value="details" className="border-0">
                                <AccordionTrigger className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:no-underline hover:bg-muted/30 [&[data-state=open]>svg]:-rotate-180 gap-2">
                                    <span>Detalles de Venta</span>
                                </AccordionTrigger>
                                <AccordionContent className="px-2 pb-2 pt-0">
                                    <div className="flex flex-col gap-1.5">
                                        <div className="flex items-center justify-between text-[11px]">
                                            <div className="flex items-center gap-1.5 text-muted-foreground uppercase font-bold tracking-tight">
                                                <User className="h-3 w-3 text-primary" />
                                                <span>Cliente</span>
                                            </div>
                                            <span className="font-bold text-primary truncate max-w-[180px]">{customerName}</span>
                                        </div>

                                        {dteType && (
                                            <div className="flex items-center justify-between text-[11px]">
                                                <div className="flex items-center gap-1.5 text-muted-foreground uppercase font-bold tracking-tight">
                                                    <FileText className="h-3 w-3 text-primary" />
                                                    <span>Documento</span>
                                                </div>
                                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border border-primary/20 bg-primary/10 text-primary">
                                                    {getDteLabel(dteType)}
                                                </span>
                                            </div>
                                        )}

                                        {deliveryType && (
                                            <div className="flex items-center justify-between text-[11px]">
                                                <div className="flex items-center gap-1.5 text-muted-foreground uppercase font-bold tracking-tight">
                                                    <Truck className="h-3 w-3 text-success" />
                                                    <span>Logística</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-sm border border-success/20 bg-success/10 text-success">
                                                        {getDeliveryLabel(deliveryType)}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-1 font-mono font-medium">
                                                        <Calendar className="h-3 w-3" />
                                                        {deliveryDate ? formatPlainDate(deliveryDate) : formatPlainDate(new Date())}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    )}

                    {/* Status Bar removed from here */}

                    {posMode === 'SHOPPING' && (
                        <>
                            {/* Quick Sale Button */}
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-full font-bold border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all",
                                    isTouchPOS ? "h-14 text-base" : "h-10 text-sm"
                                )}
                                disabled={loading || items.length === 0 || !canQuickSale.allowed}
                                onClick={onQuickSale}
                                title={!canQuickSale.allowed ? canQuickSale.reason : "Venta rápida: Saltar directo a pago con BOLETA"}
                            >
                                <Zap className={cn(
                                    "mr-2",
                                    isTouchPOS ? "h-6 w-6" : "h-5 w-5"
                                )} />
                                {!canQuickSale.allowed ? canQuickSale.reason : "Venta Rápida"}
                            </Button>

                            {/* Partner Withdrawal */}
                            {onWithdrawClick && items.length > 0 && items.every(i => i.track_inventory) && (
                                <Button
                                    variant="default"
                                    className={cn(
                                        "w-full font-bold bg-warning text-warning-foreground hover:bg-warning/90 shadow-sm",
                                        isTouchPOS ? "h-14 text-base" : "h-10 text-sm"
                                    )}
                                    onClick={onWithdrawClick}
                                >
                                    <ShoppingCart className={cn(
                                        "mr-2",
                                        isTouchPOS ? "h-6 w-6" : "h-5 w-5"
                                    )} />
                                    Retiro de Socio
                                </Button>
                            )}
                        </>
                    )}

                    {/* Totals */}
                    <div className="space-y-0.5">
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Subtotal Neto</span>
                            <span>{formatCurrency(totals.total_net)}</span>
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>IVA (19%)</span>
                            <span>{formatCurrency(totals.total_tax)}</span>
                        </div>

                        {/* Line Discounts (Sum of all per-item discounts) */}
                        {(totals.line_discount_total || 0) > 0 && (
                            <div className="flex justify-between text-xs text-muted-foreground/80 italic">
                                <span>Descuentos por Línea</span>
                                <span>-{formatCurrency(totals.line_discount_total || 0)}</span>
                            </div>
                        )}

                        {/* Global Discount (Editable) */}
                        {(showTotalDiscounts || (totals.global_discount_total || 0) > 0) && (
                            <div className="flex justify-between items-center py-0.5">
                                <span className={cn(
                                    "text-xs font-medium",
                                    (totalDiscountAmount || 0) > 0 ? "text-primary font-bold" : "text-muted-foreground"
                                )}>
                                    Descuento Global
                                </span>
                                {showTotalDiscounts ? (
                                    <button
                                        className={cn(
                                            "text-xs font-semibold cursor-pointer underline underline-offset-2 hover:text-primary text-right",
                                            (totalDiscountAmount || 0) > 0 ? "text-primary font-bold" : "text-muted-foreground"
                                        )}
                                        onClick={() => onOpenNumpad('cart', 'discount', totalDiscountAmount || 0)}
                                        type="button"
                                    >
                                        {totalDiscountAmount ? formatCurrency(totalDiscountAmount) : "$0"}
                                    </button>
                                ) : (
                                    <span className={cn(
                                        "font-medium",
                                        (totals.global_discount_total || 0) > 0 && "text-primary"
                                    )}>
                                        -{formatCurrency(totals.global_discount_total || 0)}
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="flex justify-between text-lg font-bold pt-1.5 border-t">
                            <span>Total</span>
                            <span>{formatCurrency(totals.total_gross)}</span>
                        </div>
                    </div>

                    {posMode === 'SHOPPING' && (
                        /* Confirm Sale Button */
                        <Button
                            id="confirm-sale-btn"
                            className={cn(
                                "w-full shadow-lg font-black uppercase tracking-tight",
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
                </div>
            </CardContent>
        </Card>
    )
}
