"use client"

import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from "@/lib/money"
import { useTouchMode } from '@/hooks/useTouchMode'
import { Trash2, Minus, Plus } from 'lucide-react'
import type { CartItem as CartItemType, Product, UoM } from '@/types/pos'
import type { UoM as EntityUoM } from '@/types/entities'

interface CartItemProps {
    item: CartItemType
    originalProduct?: Product
    uoms: UoM[]
    maxQty?: number
    onQuantityChange: (cartItemId: string, qty: number | string) => void
    onUomChange: (cartItemId: string, uomId: number, uomName: string) => void
    onPriceChange: (cartItemId: string, priceGross: number) => void
    onDiscountChange: (cartItemId: string, amount: number, percent: number) => void
    onRemove: (cartItemId: string) => void
    onOpenNumpad: (cartItemId: string, field: 'qty' | 'price' | 'discount', currentValue: number) => void
    showLineDiscount?: boolean
    posMode?: 'SHOPPING' | 'CHECKOUT'
}

function CartItemComponent({
    item,
    originalProduct,
    uoms,
    maxQty,
    onQuantityChange,
    onUomChange,
    onPriceChange,
    onDiscountChange,
    onRemove,
    onOpenNumpad,
    showLineDiscount,
    posMode = 'SHOPPING'
}: CartItemProps) {
    const { isTouchMode } = useTouchMode()

    const itemUom = uoms.find(u => u.id === item.uom)

    const saleUoms: EntityUoM[] = originalProduct?.available_uoms?.length
        ? originalProduct.available_uoms.map(u => ({
            id: u.id, name: u.name, category: u.category, ratio: Number(u.ratio)
        }))
        : uoms.filter(u => u.category === itemUom?.category).map(u => ({
            id: u.id, name: u.name, category: u.category, ratio: Number(u.ratio)
        }))

    const hasMultipleUoms = saleUoms.length > 1
    const [uomDialogOpen, setUomDialogOpen] = useState(false)

    const qtyRef = useRef(item.qty)
    const maxQtyRef = useRef(maxQty)
    const cartItemIdRef = useRef(item.cartItemId)
    const onQuantityChangeRef = useRef(onQuantityChange)
    const longPressRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        qtyRef.current = item.qty
        maxQtyRef.current = maxQty
        cartItemIdRef.current = item.cartItemId
        onQuantityChangeRef.current = onQuantityChange
    })

    const startLongPress = useCallback((delta: number) => {
        const currentQty = qtyRef.current
        const currentMax = maxQtyRef.current
        const newQty = Math.max(0.01, currentQty + delta)
        if (currentMax !== undefined && currentMax !== Infinity && newQty > currentMax) return
        onQuantityChangeRef.current(cartItemIdRef.current, newQty)

        const interval = setInterval(() => {
            const latestQty = qtyRef.current
            const latestMax = maxQtyRef.current
            const nextQty = Math.max(0.01, latestQty + delta)
            if (latestMax !== undefined && latestMax !== Infinity && nextQty > latestMax) {
                clearInterval(interval)
                longPressRef.current = null
                return
            }
            onQuantityChangeRef.current(cartItemIdRef.current, nextQty)
        }, 120)
        longPressRef.current = interval
    }, [])

    const clearLongPress = useCallback(() => {
        if (longPressRef.current) {
            clearInterval(longPressRef.current)
            longPressRef.current = null
        }
    }, [])

    useEffect(() => {
        return () => {
            if (longPressRef.current) {
                clearInterval(longPressRef.current)
            }
        }
    }, [])

    const handleUomChange = async (newUomId: string) => {
        const newUom = uoms.find(u => u.id.toString() === newUomId)
        if (newUom) {
            onUomChange(item.cartItemId, parseInt(newUomId), newUom.name)
        }
    }

    const handleDiscountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newAmount = parseFloat(e.target.value) || 0
        const totalBeforeDiscount = item.qty * item.unit_price_gross
        const newPercent = totalBeforeDiscount > 0 ? (newAmount / totalBeforeDiscount) * 100 : 0
        onDiscountChange(item.cartItemId, newAmount, newPercent)
    }

    const handleQtyStep = (delta: number) => {
        const newQty = Math.max(0.01, item.qty + delta)
        if (maxQty !== undefined && maxQty !== Infinity && newQty > maxQty) return
        onQuantityChange(item.cartItemId, newQty)
    }

    const isOverLimit = maxQty !== undefined && maxQty !== Infinity && item.qty > maxQty

    return (
        <div
            className="flex flex-col gap-1.5 p-2 rounded-md border bg-card group"
            style={isTouchMode ? { touchAction: 'manipulation' } : undefined}
        >
            <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2">
                <div className="flex flex-col min-w-0">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className={cn("font-bold truncate block cursor-default", isTouchMode ? "text-sm" : "text-xs")}>
                                {item.name}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{item.name}</TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-1.5 text-muted-foreground flex-wrap">
                        <span className={isTouchMode ? "text-[10px]" : "text-[9px]"}>{formatCurrency(item.unit_price_gross)}/u</span>
                        {originalProduct?.is_dynamic_pricing && (
                            <button onClick={() => isTouchMode && onOpenNumpad(item.cartItemId, 'price', item.unit_price_gross || 0)} className={cn("text-primary underline-offset-2 hover:underline", isTouchMode ? "text-[10px]" : "text-[9px]")} type="button">
                                Editar
                            </button>
                        )}
                        <span className={isTouchMode ? "text-[10px]" : "text-[9px]"}>•</span>
                        <span className={isTouchMode ? "text-[10px]" : "text-[9px]"}>Neto: {formatCurrency(item.unit_price_net)}</span>
                    </div>
                </div>

                <div className="flex flex-col items-center gap-0">
                    <div className="flex items-start gap-1">
                        <button
                            className={cn(
                                "rounded-full border-2 border-primary/20 hover:border-primary hover:bg-primary/5 shrink-0 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none",
                                isTouchMode ? "min-h-[36px] min-w-[36px]" : "h-8 w-8"
                            )}
                            {...(isTouchMode ? {
                                onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); startLongPress(-1) },
                                onPointerUp: clearLongPress,
                                onPointerLeave: clearLongPress,
                            } : {
                                onClick: () => handleQtyStep(-1),
                            })}
                            disabled={item.qty <= 0.01}
                            type="button"
                        >
                            <Minus className={cn("text-muted-foreground", isTouchMode ? "h-5 w-5" : "h-3 w-3")} />
                        </button>

                        <div className="flex flex-col items-center gap-0">
                            {isTouchMode ? (
                                <div className="min-w-[48px] text-center cursor-pointer select-none" onClick={() => onOpenNumpad(item.cartItemId, 'qty', item.qty)}>
                                    <span className={cn("font-black leading-none", isOverLimit && "text-destructive", isTouchMode ? "text-base" : "text-sm")}>
                                        {item.qty}
                                    </span>
                                </div>
                            ) : (
                                <Input
                                    type="number"
                                    className={cn("h-7 w-10 text-center font-bold bg-background border-none focus-visible:ring-1 focus-visible:ring-primary shadow-none p-0", isOverLimit && "text-destructive", "text-xs")}
                                    value={item.qty}
                                    onChange={(e) => onQuantityChange(item.cartItemId, e.target.value)}
                                    min="0.01"
                                />
                            )}
                            {maxQty !== undefined && maxQty !== Infinity && (
                                <span className={cn("leading-none mt-px", isOverLimit ? "text-destructive font-semibold" : "text-muted-foreground", isTouchMode ? "text-[10px]" : "text-[9px]")}>
                                    MAX:{maxQty}
                                </span>
                            )}
                        </div>

                        <button
                            className={cn(
                                "rounded-full border-2 border-primary/20 hover:border-primary hover:bg-primary/5 shrink-0 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none",
                                isTouchMode ? "min-h-[36px] min-w-[36px]" : "h-8 w-8"
                            )}
                            {...(isTouchMode ? {
                                onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); startLongPress(1) },
                                onPointerUp: clearLongPress,
                                onPointerLeave: clearLongPress,
                            } : {
                                onClick: () => handleQtyStep(1),
                            })}
                            disabled={maxQty !== undefined && maxQty !== Infinity && item.qty >= maxQty}
                            type="button"
                        >
                            <Plus className={cn("text-muted-foreground", isTouchMode ? "h-5 w-5" : "h-3 w-3")} />
                        </button>

                        {hasMultipleUoms ? (
                            <button
                                type="button"
                                className={cn(
                                    "font-semibold underline underline-offset-2 whitespace-nowrap border-none bg-transparent text-muted-foreground hover:text-primary cursor-pointer flex items-center",
                                    isTouchMode ? "text-xs min-h-[36px] px-2" : "text-[11px] h-[13px] pt-px"
                                )}
                                onClick={() => setUomDialogOpen(true)}
                            >
                                {item.uom_name}
                            </button>
                        ) : (
                            <span className={cn("text-muted-foreground/60", isTouchMode ? "text-xs" : "text-[11px]")}>
                                {item.uom_name}
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex items-start gap-1.5 justify-self-end">
                    <div className="flex flex-col items-end">
                        <span className="text-sm font-bold text-primary leading-none">{formatCurrency(item.total_gross)}</span>
                        <span className={cn("text-muted-foreground leading-none", isTouchMode ? "text-[10px]" : "text-[9px]")}>
                            Neto {formatCurrency(item.total_net)}
                        </span>
                        {showLineDiscount && (
                            isTouchMode ? (
                                <button className={cn("font-semibold text-foreground cursor-pointer underline underline-offset-2 hover:text-primary whitespace-nowrap flex items-center", isTouchMode ? "text-xs min-h-[36px] px-0" : "text-[11px]")} onClick={() => onOpenNumpad(item.cartItemId, 'discount', item.discount_amount || 0)} type="button">
                                    Dscto: {item.discount_amount ? formatCurrency(item.discount_amount) : "$0"}
                                </button>
                            ) : (
                                <div className="flex items-center gap-0.5 mt-0.5">
                                    <span className="text-[10px] font-semibold text-muted-foreground">Dscto:</span>
                                    <Input type="number" className={cn("h-6 w-16 text-right text-xs bg-background border border-muted-foreground/30 rounded focus-visible:ring-1 focus-visible:ring-primary p-0 pr-1", (item.discount_amount || 0) > 0 && "text-primary font-bold")} value={item.discount_amount || ""} placeholder="0" onChange={handleDiscountChange} />
                                </div>
                            )
                        )}
                    </div>
                    {posMode === 'SHOPPING' && (
                        <button
                            className={cn(
                                "flex items-center justify-center text-muted-foreground hover:text-destructive transition-all rounded-full hover:bg-destructive/10 shrink-0",
                                isTouchMode
                                    ? "min-h-[44px] min-w-[44px] opacity-100"
                                    : "h-8 w-8 opacity-0 group-hover:opacity-100"
                            )}
                            onClick={() => onRemove(item.cartItemId)}
                            type="button"
                        >
                            <Trash2 className={isTouchMode ? "h-5 w-5" : "h-4 w-4"} />
                        </button>
                    )}
                </div>
            </div>

            <Dialog open={uomDialogOpen} onOpenChange={setUomDialogOpen}>
                <DialogContent className="w-[240px] rounded-lg">
                    <DialogHeader>
                        <DialogTitle>Unidad</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-0.5">
                        {saleUoms.map(uom => (
                            <button
                                key={uom.id}
                                type="button"
                                className={cn(
                                    "w-full text-left px-3 py-2 text-sm rounded-sm hover:bg-accent transition-colors",
                                    item.uom === uom.id && "bg-accent font-semibold"
                                )}
                                onClick={() => {
                                    handleUomChange(String(uom.id))
                                    setUomDialogOpen(false)
                                }}
                            >
                                {uom.name}
                            </button>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export const CartItem = memo(CartItemComponent, (prevProps, nextProps) => {
    return (
        prevProps.item === nextProps.item &&
        prevProps.maxQty === nextProps.maxQty &&
        prevProps.onQuantityChange === nextProps.onQuantityChange &&
        prevProps.showLineDiscount === nextProps.showLineDiscount &&
        prevProps.posMode === nextProps.posMode
    )
})
