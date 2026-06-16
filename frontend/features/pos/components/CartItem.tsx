"use client"

import { memo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from "@/lib/money"
import { useDeviceContext } from '@/hooks/useDeviceContext'
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

const stepperBtnClass = "rounded-full h-8 w-8 border-2 border-primary/20 hover:border-primary hover:bg-primary/5 shrink-0 flex items-center justify-center transition-colors disabled:opacity-30 disabled:pointer-events-none"

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
    const { isTouchPOS } = useDeviceContext()
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

    const handleUomChange = async (newUomId: string) => {
        const newUom = uoms.find(u => u.id.toString() === newUomId)
        if (newUom) {
            onUomChange(item.cartItemId, parseInt(newUomId), newUom.name)
        }
    }

    const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newGross = parseFloat(e.target.value) || 0
        onPriceChange(item.cartItemId, newGross)
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
        <div className="flex flex-col gap-1 p-3 rounded-lg border border-border/40 bg-card/5 group">
            <div className="grid grid-cols-[1fr_auto_1fr_auto_auto] gap-x-1 items-start">
                <div className="flex flex-col">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span className="font-bold text-xs truncate block cursor-default">
                                {item.name}
                            </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">{item.name}</TooltipContent>
                    </Tooltip>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                        <span>{formatCurrency(item.unit_price_gross)}/u</span>
                        {originalProduct?.is_dynamic_pricing && (
                            <button onClick={() => isTouchMode && onOpenNumpad(item.cartItemId, 'price', item.unit_price_gross || 0)} className="text-primary underline-offset-2 hover:underline" type="button">Editar</button>
                        )}
                        <span>•</span>
                        <span>Neto: {formatCurrency(item.unit_price_net)}</span>
                    </div>
                    {maxQty !== undefined && maxQty !== Infinity && (
                        <span className={cn("text-[10px]", isOverLimit ? "text-destructive font-semibold" : "text-muted-foreground")}>MAX:{maxQty}</span>
                    )}
                </div>

                <div className="flex flex-col items-center gap-0">
                    <div className="flex items-center gap-1">
                        <button className={stepperBtnClass} onClick={() => handleQtyStep(-1)} disabled={item.qty <= 0.01} type="button">
                            <Minus className="h-3 w-3 text-muted-foreground" />
                        </button>
                        {isTouchMode ? (
                            <div className="w-10 text-center cursor-pointer select-none" onClick={() => onOpenNumpad(item.cartItemId, 'qty', item.qty)}>
                                <span className={cn("text-sm font-black leading-none", isOverLimit && "text-destructive")}>{item.qty}</span>
                            </div>
                        ) : (
                            <Input type="number" className={cn("h-7 w-10 text-center text-xs font-bold bg-background border-none focus-visible:ring-1 focus-visible:ring-primary shadow-none p-0", isOverLimit && "text-destructive")} value={item.qty} onChange={(e) => onQuantityChange(item.cartItemId, e.target.value)} min="0.01" />
                        )}
                        <button className={stepperBtnClass} onClick={() => handleQtyStep(1)} disabled={maxQty !== undefined && maxQty !== Infinity && item.qty >= maxQty} type="button">
                            <Plus className="h-3 w-3 text-muted-foreground" />
                        </button>
                    </div>
                    <button
                        type="button"
                        className={cn(
                            "text-[11px] font-semibold underline underline-offset-2 whitespace-nowrap leading-[0] p-0 m-0 border-none bg-transparent h-[13px] flex items-start pt-px",
                            hasMultipleUoms
                                ? "text-muted-foreground hover:text-primary cursor-pointer"
                                : "text-muted-foreground/60"
                        )}
                        onClick={() => hasMultipleUoms && setUomDialogOpen(true)}
                        disabled={!hasMultipleUoms}
                    >
                        {item.uom_name}
                    </button>
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
                                            "w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors",
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

                <div />

                <div className="flex flex-col items-end ml-6">
                    <span className="text-sm font-bold text-primary leading-none">{formatCurrency(item.total_gross)}</span>
                    <span className="text-[10px] text-muted-foreground font-medium leading-tight">Neto {formatCurrency(item.total_net)}</span>
                    {showLineDiscount && (
                        isTouchMode ? (
                            <button className="text-[11px] font-semibold text-foreground cursor-pointer underline underline-offset-2 hover:text-primary whitespace-nowrap" onClick={() => onOpenNumpad(item.cartItemId, 'discount', item.discount_amount || 0)} type="button">
                                Dscto: {item.discount_amount ? formatCurrency(item.discount_amount) : "$0"}
                            </button>
                        ) : (
                            <div className="flex items-center gap-0.5 justify-end">
                                <span className="text-[10px] font-semibold text-muted-foreground">Dscto:</span>
                                <Input type="number" className={cn("h-7 w-16 text-right text-xs bg-background border border-muted-foreground/30 rounded focus-visible:ring-1 focus-visible:ring-primary p-0 pr-1", (item.discount_amount || 0) > 0 && "text-primary font-bold")} value={item.discount_amount || ""} placeholder="0" onChange={handleDiscountChange} />
                            </div>
                        )
                    )}
                </div>

                <div>
                    {posMode === 'SHOPPING' && (
                        <button className={cn("flex items-center justify-center text-muted-foreground hover:text-destructive transition-all h-8 w-8 rounded-full hover:bg-destructive/10", isTouchMode ? "opacity-100" : "opacity-0 group-hover:opacity-100")} onClick={() => onRemove(item.cartItemId)} type="button">
                            <Trash2 className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>
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
