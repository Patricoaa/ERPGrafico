"use client"

import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from "@/lib/money"
import { useTouchMode } from '@/hooks/useTouchMode'
import { Trash2, Minus, Plus } from 'lucide-react'
import type { CartItem as CartItemType, Product, UoM } from '../types'
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
            className={cn(
                "flex flex-col gap-2 rounded-lg border border-border bg-card group transition-colors hover:border-border/80",
                isTouchMode ? "p-3" : "p-2.5"
            )}
            style={isTouchMode ? { touchAction: 'manipulation' } : undefined}
        >
            {/* Top Row: Name and Total/Delete */}
            <div className="flex justify-between items-start gap-3">
                <div className="flex flex-col min-w-0 flex-1">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className={cn(
                                "font-bold truncate block cursor-default text-foreground/90", 
                                isTouchMode ? "text-base" : "text-sm"
                            )}>
                                {item.name}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{item.name}</TooltipContent>
                    </Tooltip>
                    
                    {/* Unit Price Info */}
                    {originalProduct?.is_dynamic_pricing && (
                        <button 
                            onClick={() => isTouchMode && onOpenNumpad(item.cartItemId, 'price', item.unit_price_gross || 0)} 
                            className={cn(
                                "text-primary text-left underline-offset-2 hover:underline font-medium transition-colors mt-0.5", 
                                isTouchMode ? "text-xs" : "text-[11px]"
                            )} 
                            type="button"
                        >
                            Editar precio
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Discount */}
                    {showLineDiscount && (
                        isTouchMode ? (
                            <button 
                                className={cn(
                                    "font-semibold text-foreground cursor-pointer hover:bg-muted transition-colors rounded px-2 h-8 flex items-center justify-center underline underline-offset-4 decoration-border hover:decoration-foreground", 
                                    isTouchMode ? "text-sm" : "text-xs",
                                    (item.discount_amount || 0) > 0 ? "bg-destructive/10 text-destructive hover:bg-destructive/20 decoration-destructive/50 hover:decoration-destructive" : "bg-transparent text-muted-foreground"
                                )} 
                                onClick={() => onOpenNumpad(item.cartItemId, 'discount', item.discount_amount || 0)} 
                                type="button"
                                title="Descuento"
                            >
                                {item.discount_amount ? (
                                    <span className="font-bold">-{formatCurrency(item.discount_amount)}</span>
                                ) : (
                                    <span className="opacity-60 hover:opacity-100">-%</span>
                                )}
                            </button>
                        ) : (
                            <div className="flex items-center gap-1">
                                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Dscto:</span>
                                <Input 
                                    type="number" 
                                    className={cn(
                                        "h-7 w-16 text-right text-xs bg-muted/50 border-none rounded focus-visible:ring-1 focus-visible:ring-primary p-0 pr-1", 
                                        (item.discount_amount || 0) > 0 && "text-destructive font-bold bg-destructive/10"
                                    )} 
                                    value={item.discount_amount || ""} 
                                    placeholder="0" 
                                    onChange={handleDiscountChange} 
                                />
                            </div>
                        )
                    )}

                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className={cn(
                                "font-black text-primary leading-none cursor-help",
                                isTouchMode ? "text-lg ml-1" : "text-base ml-1"
                            )}>
                                {formatCurrency(item.total_gross)}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="flex flex-col gap-1 text-xs">
                                <span>Bruto: {formatCurrency(item.unit_price_gross)}/u</span>
                                <span>Neto: {formatCurrency(item.unit_price_net)}/u</span>
                            </div>
                        </TooltipContent>
                    </Tooltip>

                    {posMode === 'SHOPPING' && (
                        <button
                            className={cn(
                                "flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors rounded-md shrink-0 ml-1",
                                isTouchMode ? "h-10 w-10" : "h-7 w-7 opacity-0 group-hover:opacity-100"
                            )}
                            onClick={() => onRemove(item.cartItemId)}
                            type="button"
                            title="Eliminar"
                        >
                            <Trash2 className={isTouchMode ? "h-5 w-5" : "h-4 w-4"} />
                        </button>
                    )}
                </div>
            </div>

            {/* Bottom Row: UoM & Pill Stepper */}
            <div className="flex items-center justify-between border-t border-border/50 pt-2.5 mt-0.5">
                <div className="flex items-center">
                    {hasMultipleUoms ? (
                        <button
                            type="button"
                            className={cn(
                                "font-semibold underline underline-offset-2 border-none bg-transparent text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center px-1 rounded-sm hover:bg-primary/5",
                                isTouchMode ? "text-sm h-8" : "text-xs h-6"
                            )}
                            onClick={() => setUomDialogOpen(true)}
                        >
                            {item.uom_name}
                        </button>
                    ) : (
                        <span className={cn(
                            "text-muted-foreground/70 font-medium px-1", 
                            isTouchMode ? "text-sm" : "text-xs"
                        )}>
                            {item.uom_name}
                        </span>
                    )}
                </div>

                {/* Right Side: Pill Stepper with floating MAX Chip */}
                <div className="relative flex flex-col items-center">
                    {/* Pill Stepper */}
                    <div className={cn(
                        "flex items-center bg-muted/40 border border-border/50 rounded-md overflow-hidden",
                        isTouchMode ? "h-9" : "h-7"
                    )}>
                    <button
                        className={cn(
                            "flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none active:bg-black/10",
                            isTouchMode ? "w-10 h-full" : "w-7 h-full"
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
                        <Minus className={cn("text-foreground", isTouchMode ? "h-4 w-4" : "h-3 w-3")} />
                    </button>

                    <div className="flex flex-col items-center justify-center border-x border-border/50 bg-background/50 h-full">
                        {isTouchMode ? (
                            <div className="w-12 text-center cursor-pointer select-none flex items-center justify-center h-full" onClick={() => onOpenNumpad(item.cartItemId, 'qty', item.qty)}>
                                <span className={cn(
                                    "font-black text-foreground", 
                                    isOverLimit && "text-destructive", 
                                    isTouchMode ? "text-sm" : "text-xs"
                                )}>
                                    {item.qty}
                                </span>
                            </div>
                        ) : (
                            <Input
                                type="number"
                                className={cn(
                                    "h-full w-10 text-center font-bold bg-transparent border-none focus-visible:ring-0 shadow-none p-0", 
                                    isOverLimit && "text-destructive", 
                                    "text-xs"
                                )}
                                value={item.qty}
                                onChange={(e) => onQuantityChange(item.cartItemId, e.target.value)}
                                min="0.01"
                            />
                        )}
                    </div>

                    <button
                        className={cn(
                            "flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none active:bg-black/10",
                            isTouchMode ? "w-10 h-full" : "w-7 h-full"
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
                        <Plus className={cn("text-foreground", isTouchMode ? "h-4 w-4" : "h-3 w-3")} />
                    </button>
                </div>

                {maxQty !== undefined && maxQty !== Infinity && (
                    <div className={cn(
                        "absolute -bottom-2 flex items-center px-1.5 py-px rounded-full font-bold uppercase tracking-wider border shadow-sm",
                        isTouchMode ? "text-[9px]" : "text-[8px]",
                        isOverLimit 
                            ? "bg-destructive text-destructive-foreground border-destructive" 
                            : "bg-background text-muted-foreground border-border/70"
                    )}>
                        Max {maxQty}
                    </div>
                )}
                </div>
            </div>

            <Dialog open={uomDialogOpen} onOpenChange={setUomDialogOpen}>
                <DialogContent className="w-[260px] rounded-xl p-4">
                    <DialogHeader>
                        <DialogTitle className="text-center font-bold">Seleccionar Unidad</DialogTitle>
                    </DialogHeader>
                    <div className="flex flex-col gap-1 mt-2">
                        {saleUoms.map(uom => (
                            <button
                                key={uom.id}
                                type="button"
                                className={cn(
                                    "w-full text-center px-4 py-3 text-sm rounded-lg hover:bg-muted transition-colors border border-transparent",
                                    item.uom === uom.id && "bg-primary/5 border-primary/20 text-primary font-bold"
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
