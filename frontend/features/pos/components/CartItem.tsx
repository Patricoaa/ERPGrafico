"use client"

import { Button } from "@/components/ui/button"
import { memo, useState, useRef, useEffect, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { BaseModal, SummaryLine } from "@/components/shared"
import { cn } from '@/lib/utils'
import { formatCurrency } from "@/lib/money"
import { useTouchMode } from '@/hooks/useTouchMode'
import { Trash2, Minus, Plus, Percent, ChevronDown } from 'lucide-react'
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

    const handleQtyStep = (delta: number) => {
        const newQty = Math.max(0.01, item.qty + delta)
        if (maxQty !== undefined && maxQty !== Infinity && newQty > maxQty) return
        onQuantityChange(item.cartItemId, newQty)
    }

    const isOverLimit = maxQty !== undefined && maxQty !== Infinity && item.qty > maxQty

    const hasDiscount = (item.discount_amount || 0) > 0
    const hasMax = maxQty !== undefined && maxQty !== Infinity
    const stepBtn = "size-control-lg rounded-none border-none shadow-none hover:bg-accent disabled:opacity-30 disabled:pointer-events-none active:bg-overlay/10"

    const stepper = (
        <div className="flex h-control-lg items-center overflow-hidden rounded-sm border border-border bg-background">
            <Button
                variant="ghost"
                className={stepBtn}
                aria-label="Disminuir cantidad"
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
                <Minus className="size-4" aria-hidden />
            </Button>

            {isTouchMode ? (
                <button
                    type="button"
                    className={cn("h-full w-14 select-none border-x border-border text-center font-mono text-base font-bold tabular-nums", isOverLimit && "text-destructive")}
                    onClick={() => onOpenNumpad(item.cartItemId, 'qty', item.qty)}
                    aria-label={`Cantidad ${item.qty}. Tocar para editar`}
                >
                    {item.qty}
                </button>
            ) : (
                <Input
                    type="number"
                    inputMode="decimal"
                    className={cn("h-full w-14 rounded-none border-x border-y-0 border-border bg-transparent p-0 text-center font-mono text-base font-bold shadow-none focus-visible:ring-0", isOverLimit && "text-destructive")}
                    value={item.qty}
                    onChange={(e) => onQuantityChange(item.cartItemId, e.target.value)}
                    min="0.01"
                    aria-label="Cantidad"
                />
            )}

            <Button
                variant="ghost"
                className={stepBtn}
                aria-label="Aumentar cantidad"
                {...(isTouchMode ? {
                    onPointerDown: (e: React.PointerEvent) => { e.preventDefault(); startLongPress(1) },
                    onPointerUp: clearLongPress,
                    onPointerLeave: clearLongPress,
                } : {
                    onClick: () => handleQtyStep(1),
                })}
                disabled={hasMax && item.qty >= (maxQty ?? 0)}
                type="button"
            >
                <Plus className="size-4" aria-hidden />
            </Button>
        </div>
    )

    const uom = hasMultipleUoms ? (
        <Button
            variant="outline"
            type="button"
            className="h-control-lg gap-1 rounded-sm px-3 text-sm font-semibold text-foreground"
            onClick={() => setUomDialogOpen(true)}
        >
            {item.uom_name}
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden />
        </Button>
    ) : (
        <span className="text-sm">{item.uom_name}</span>
    )

    const badges = (
        <>
            {hasDiscount && (
                <span className="rounded-sm bg-destructive/10 px-1.5 py-0.5 font-mono text-xs font-bold tabular-nums text-destructive">
                    -{formatCurrency(item.discount_amount)}
                </span>
            )}
            {hasMax && (
                <span className={cn(
                    "rounded-full border px-1.5 py-px text-3xs font-bold uppercase tracking-wider",
                    isOverLimit ? "border-destructive bg-destructive text-destructive-foreground" : "border-border text-muted-foreground"
                )}>
                    Máx {maxQty}
                </span>
            )}
            {originalProduct?.is_dynamic_pricing && (
                <Button
                    type="button"
                    variant="ghost"
                    className="h-control-sm px-2 text-xs font-medium text-primary underline underline-offset-2"
                    onClick={() => onOpenNumpad(item.cartItemId, 'price', item.unit_price_gross || 0)}
                >
                    Editar precio
                </Button>
            )}
        </>
    )

    const actions = (
        <>
            {showLineDiscount && (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={cn("size-control-lg rounded-sm", hasDiscount ? "border-destructive/40 text-destructive" : "text-muted-foreground hover:text-foreground")}
                    onClick={() => onOpenNumpad(item.cartItemId, 'discount', item.discount_amount || 0)}
                    aria-label={hasDiscount ? "Editar descuento" : "Agregar descuento"}
                >
                    <Percent className="size-4" aria-hidden />
                </Button>
            )}
            {posMode === 'SHOPPING' && (
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-control-lg rounded-sm text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => onRemove(item.cartItemId)}
                    aria-label={`Eliminar ${item.name}`}
                >
                    <Trash2 className="size-4" aria-hidden />
                </Button>
            )}
        </>
    )

    return (
        <div style={isTouchMode ? { touchAction: 'manipulation' } : undefined}>
            <SummaryLine
                name={item.name}
                total={formatCurrency(item.total_gross)}
                unit={<>{formatCurrency(item.unit_price_gross)} ×</>}
                stepper={stepper}
                uom={uom}
                badges={badges}
                actions={actions}
            />

            <BaseModal
                open={uomDialogOpen}
                onOpenChange={setUomDialogOpen}
                title="Seleccionar Unidad"
                size="xs"
                className="w-[260px]"
                hideScrollArea
                contentClassName="p-0"
            >
                <div className="flex flex-col gap-1 mt-2 px-4 pb-4">
                    {saleUoms.map(uom => (
                        <Button
                            key={uom.id}
                            variant="ghost"
                            type="button"
                            className={cn(
                                "h-control-touch w-full rounded-lg border border-transparent px-4 text-center text-base shadow-none hover:bg-muted",
                                item.uom === uom.id && "bg-primary/5 border-primary/20 text-primary font-medium"
                            )}
                            onClick={() => {
                                handleUomChange(String(uom.id))
                                setUomDialogOpen(false)
                            }}
                        >
                            {uom.name}
                        </Button>
                    ))}
                </div>
            </BaseModal>
        </div>
    )
}

export const CartItem = memo(CartItemComponent, (prevProps, nextProps) => {
    return (
        prevProps.item === nextProps.item &&
        prevProps.originalProduct === nextProps.originalProduct &&
        prevProps.uoms === nextProps.uoms &&
        prevProps.maxQty === nextProps.maxQty &&
        prevProps.onQuantityChange === nextProps.onQuantityChange &&
        prevProps.onUomChange === nextProps.onUomChange &&
        prevProps.onPriceChange === nextProps.onPriceChange &&
        prevProps.onRemove === nextProps.onRemove &&
        prevProps.onOpenNumpad === nextProps.onOpenNumpad &&
        prevProps.showLineDiscount === nextProps.showLineDiscount &&
        prevProps.posMode === nextProps.posMode
    )
})
