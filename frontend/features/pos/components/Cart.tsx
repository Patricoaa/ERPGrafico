"use client"

// Cart Component
// Shopping cart display with totals and actions

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ShoppingCart, Zap, ChevronLeft, ChevronRight, Check, Share2, Percent, Users, Trash2, ChevronDown } from 'lucide-react'
import {
    ActionConfirmModal, AutoSaveStatusBadge, SummaryActionRow, SummaryActions, SummaryLineList,
    SummaryMenu, SummaryPanel, SummaryPanelHeader, SummaryTotal,
    type SummaryMenuItem,
} from '@/components/shared'
import type { AutoSaveStatus } from '@/hooks/useAutoSaveForm'
import { cn } from '@/lib/utils'
import { CartItem } from './CartItem'
import { formatCurrency } from "@/lib/money"
import { useVatRate } from '@/hooks/useVatRate'
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
    /** Libera el carrito para continuarlo en otro equipo (disponible en cualquier paso). */
    onHandoff?: () => void
    /** Vacía el carrito (con confirmación en el menú). */
    onClear?: () => void
    /** Estado del guardado automático del borrador. */
    autoSaveStatus?: AutoSaveStatus
    isLastStep?: boolean
    checkoutLoading?: boolean
    paymentMethod?: string | null
    paymentAmount?: number
    payments?: PaymentDisplayItem[]
}

const ACTION_BUTTON = "h-control-touch gap-2 rounded-sm text-base font-bold"
const PRIMARY_BUTTON = "h-16 gap-2 rounded-sm text-lg font-black"

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
    onHandoff,
    onClear,
    autoSaveStatus = 'idle',
    isLastStep = false,
    checkoutLoading = false,
}: CartProps) {
    const { rate } = useVatRate()
    const { canApplyLineDiscount, canApplyGlobalDiscount } = useSalesSettings()
    const [clearOpen, setClearOpen] = useState(false)

    const isEmpty = items.length === 0
    const isCheckout = posMode === 'CHECKOUT'
    const canWithdraw = !!onWithdrawClick && !isEmpty && items.every(i => i.track_inventory)

    const menuItems: SummaryMenuItem[] = [
        {
            id: 'global-discount',
            label: 'Descuento global',
            icon: Percent,
            hidden: !canApplyGlobalDiscount || isCheckout,
            detail: totalDiscountAmount > 0 ? `-${formatCurrency(totalDiscountAmount)}` : undefined,
            onSelect: () => onOpenNumpad('cart', 'discount', totalDiscountAmount || 0),
        },
        {
            id: 'withdraw',
            label: 'Retiro de socio',
            icon: Users,
            hidden: !canWithdraw || isCheckout,
            onSelect: () => onWithdrawClick?.(),
        },
        {
            id: 'clear',
            label: 'Vaciar carrito',
            icon: Trash2,
            destructive: true,
            hidden: !onClear || isEmpty || isCheckout,
            onSelect: () => setClearOpen(true),
        },
    ]

    const breakdown = [
        { label: 'Neto', value: formatCurrency(totals.total_net) },
        { label: `IVA ${rate}%`, value: formatCurrency(totals.total_tax) },
        ...((totals.line_discount_total || 0) > 0
            ? [{ label: 'Descuentos por línea', value: `-${formatCurrency(totals.line_discount_total || 0)}`, tone: 'discount' as const }]
            : []),
        ...((totals.global_discount_total || 0) > 0
            ? [{ label: 'Descuento global', value: `-${formatCurrency(totalDiscountAmount || totals.global_discount_total || 0)}`, tone: 'discount' as const }]
            : []),
    ]

    const handoffButton = (
        <Button
            type="button"
            variant="outline"
            className={cn(ACTION_BUTTON, "border-foreground/60")}
            disabled={loading || isEmpty || checkoutLoading || !onHandoff}
            onClick={onHandoff}
        >
            <Share2 className="size-5" aria-hidden />
            Continuar en otro equipo
        </Button>
    )

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <SummaryPanel>
                <SummaryPanelHeader
                    title="Carrito"
                    count={isCheckout ? undefined : items.length}
                    leading={isCheckout ? (
                        <Button type="button" variant="ghost" className="h-control-touch gap-1 px-2 text-sm font-semibold text-muted-foreground" onClick={onCancel} disabled={checkoutLoading}>
                            <ChevronLeft className="size-5" aria-hidden />
                            Editar carrito
                        </Button>
                    ) : undefined}
                    status={!isEmpty && (
                        <AutoSaveStatusBadge status={saving ? 'saving' : autoSaveStatus} />
                    )}
                    menu={<SummaryMenu items={menuItems} />}
                />

                {isCheckout ? (
                    <details open className="group flex min-h-0 flex-1 flex-col border-b border-border">
                        <summary className="flex h-control-touch shrink-0 cursor-pointer list-none items-center justify-between px-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
                            <span className="flex items-center gap-2"><ShoppingCart className="size-4" aria-hidden />{items.length} {items.length === 1 ? 'ítem' : 'ítems'}</span>
                            <ChevronDown className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden />
                        </summary>
                        <ul className="min-h-0 flex-1 space-y-1 overflow-auto px-3 pb-3 text-sm text-muted-foreground">
                            {items.map(item => (
                                <li key={item.cartItemId} className="flex justify-between gap-3">
                                    <span className="truncate">{item.name} × {item.qty}</span>
                                    <span className="font-mono tabular-nums">{formatCurrency(item.total_gross)}</span>
                                </li>
                            ))}
                        </ul>
                    </details>
                ) : (
                    <SummaryLineList
                        isEmpty={isEmpty}
                        empty={
                            <>
                                <ShoppingCart className="size-12 text-muted-foreground/30" aria-hidden />
                                <div className="space-y-1">
                                    <p className="text-lg font-bold tracking-tight text-muted-foreground">El carrito está vacío</p>
                                    <p className="mx-auto max-w-[280px] text-sm">Escanea un código de barras o toca un producto del catálogo para comenzar.</p>
                                </div>
                            </>
                        }
                    >
                        {items.map((item) => (
                            <CartItem
                                key={item.cartItemId}
                                item={item}
                                originalProduct={products.find(p => p.id === item.id)}
                                uoms={uoms}
                                maxQty={limits[`cart_${item.cartItemId}`]}
                                onQuantityChange={onItemQuantityChange}
                                onUomChange={onItemUomChange}
                                onPriceChange={onItemPriceChange}
                                onRemove={onItemRemove}
                                onOpenNumpad={onOpenNumpad}
                                showLineDiscount={canApplyLineDiscount}
                                posMode={posMode}
                            />
                        ))}
                    </SummaryLineList>
                )}

                <SummaryTotal total={formatCurrency(totals.total_gross)} breakdown={breakdown} />

                <SummaryActions hint={!isCheckout && !canQuickSale.allowed && !isEmpty ? canQuickSale.reason : undefined}>
                    {!isCheckout ? (
                        <>
                            <Button
                                type="button"
                                id="quick-sale-btn"
                                className={cn(PRIMARY_BUTTON, "w-full justify-center bg-primary px-5 text-primary-foreground hover:bg-primary/90")}
                                disabled={loading || saving || isEmpty || !canQuickSale.allowed}
                                onClick={onQuickSale}
                            >
                                <span className="flex items-center gap-2"><Zap className="size-6" aria-hidden />Venta rápida · Boleta</span>
                            </Button>
                            <SummaryActionRow>
                                <Button
                                    type="button"
                                    id="confirm-sale-btn"
                                    variant="outline"
                                    className={ACTION_BUTTON}
                                    disabled={loading || saving || isEmpty}
                                    onClick={onConfirmSale}
                                >
                                    <ShoppingCart className="size-5" aria-hidden />
                                    {loading || saving ? 'Procesando…' : 'Configurar pedido'}
                                </Button>
                                {handoffButton}
                            </SummaryActionRow>
                        </>
                    ) : (
                        <>
                            {handoffButton}
                            <SummaryActionRow ratio="1:2">
                                <Button type="button" variant="outline" className={PRIMARY_BUTTON} onClick={onCheckoutBack} disabled={checkoutLoading}>
                                    <ChevronLeft className="size-6" aria-hidden />
                                    Atrás
                                </Button>
                                {!isLastStep ? (
                                    <Button type="button" className={cn(PRIMARY_BUTTON, "bg-primary text-primary-foreground hover:bg-primary/90")} onClick={onCheckoutNext} disabled={checkoutLoading}>
                                        Siguiente
                                        <ChevronRight className="size-6" aria-hidden />
                                    </Button>
                                ) : (
                                    <Button type="button" className={cn(PRIMARY_BUTTON, "bg-success text-success-foreground hover:bg-success/90")} onClick={onCheckoutFinish} disabled={checkoutLoading}>
                                        <Check className="size-6" aria-hidden />
                                        Finalizar venta
                                    </Button>
                                )}
                            </SummaryActionRow>
                        </>
                    )}
                </SummaryActions>
            </SummaryPanel>

            <ActionConfirmModal
                open={clearOpen}
                onOpenChange={setClearOpen}
                title="Vaciar carrito"
                description="Se quitarán todos los productos del carrito."
                confirmText="Vaciar"
                variant="destructive"
                onConfirm={() => { onClear?.(); setClearOpen(false) }}
            />
        </div>
    )
}
