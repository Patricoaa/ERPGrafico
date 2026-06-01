"use client"

// CartItem Component
// Individual cart item row with inline editing

import { memo } from 'react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Chip, DataCell } from "@/components/shared"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { UoMSelector } from '@/components/selectors'
import { cn } from '@/lib/utils'
import { formatCurrency } from "@/lib/money"
import {useDeviceContext} from '@/hooks/useDeviceContext'
import { useTouchMode } from '@/hooks/useTouchMode'
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
    const { isTouchPOS } = useDeviceContext()
    const { isTouchMode } = useTouchMode()
    const itemUom = uoms.find(u => u.id === item.uom)

    const allowedUomIds = originalProduct?.allowed_sale_uoms
    const filteredUoms: UoM[] = allowedUomIds?.length
        ? uoms.filter(u => allowedUomIds.includes(u.id))
        : uoms.filter(u => u.category === itemUom?.category)

    const availableUoms: EntityUoM[] = filteredUoms.map(u => ({
        id: u.id, name: u.name, category: u.category, ratio: Number(u.ratio)
    }))

    const hasMultipleUoms = availableUoms.length > 1

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

    const isOverLimit = maxQty !== undefined && maxQty !== Infinity && item.qty > maxQty

    return (
        <TableRow className="group border-b hover:bg-muted/30 transition-colors">
            {/* Product Name */}
            <TableCell className="py-2 align-top">
                <div className="flex flex-col gap-0.5">
<Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span className="font-bold text-xs truncate max-w-[150px]">
                                                                {item.name}
                                                            </span>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top">{item.name}</TooltipContent>
                                                    </Tooltip>
                    <div className="flex flex-wrap gap-1">
                        {item.internal_code && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/30 text-muted-foreground opacity-70">
                                {item.internal_code}
                            </span>
                        )}
                        {item.code && item.code !== item.internal_code && (
                            <span className="text-[9px] font-mono font-bold uppercase px-1.5 py-0.5 rounded border border-muted-foreground/20 bg-muted/10 text-muted-foreground opacity-70">
                                {item.code}
                            </span>
                        )}
                    </div>
                </div>
            </TableCell>

            {/* Quantity */}
            <TableCell className="py-2 align-top">
                <div className="flex flex-col items-center gap-1">
                    <Input
                        type="number"
                        className={cn(
                            "h-7 w-12 text-center text-xs font-bold bg-background border-none focus-visible:ring-1 focus-visible:ring-primary shadow-none p-0",
                            isOverLimit && "text-destructive bg-destructive/10 rounded"
                        )}
                        value={item.qty}
                        onChange={(e) => onQuantityChange(item.cartItemId, e.target.value)}
                        onClick={() => isTouchMode && onOpenNumpad(item.cartItemId, 'qty', item.qty)}
                        readOnly={isTouchMode}
                        min="0.01"
                    />
                    {maxQty !== undefined && maxQty !== Infinity && (
                        <Chip
                            size="xs"
                            intent={isOverLimit ? "destructive" : "neutral"}
                            className={cn(
                                "text-[8px] px-1 h-3.5 border-0 whitespace-nowrap",
                                !isOverLimit && "bg-muted hover:bg-muted"
                            )}
                        >
                            MAX: {maxQty}
                        </Chip>
                    )}
                </div>
            </TableCell>

            {/* UoM */}
            <TableCell className="py-2 align-top">
                <div className="flex justify-center">
                    {hasMultipleUoms ? (
                        <UoMSelector
                            product={null}
                            context="stock"
                            value={item.uom?.toString() ?? ''}
                            onChange={handleUomChange}
                            uoms={availableUoms}
                            variant="inline"
                            className="h-6 text-[10px]"
                        />
                    ) : (
                        <span className="text-[10px] font-medium text-muted-foreground/80 bg-muted/30 px-1.5 py-0.5 rounded leading-none">
                            {item.uom_name}
                        </span>
                    )}
                </div>
            </TableCell>

            {/* Unit Price */}
            <TableCell className="py-2 text-right align-top">
                <div className="flex flex-col items-end gap-1">
                    {originalProduct?.is_dynamic_pricing ? (
                        <Input
                            type="number"
                            className="h-7 w-20 text-right text-xs bg-background border-none focus-visible:ring-1 focus-visible:ring-primary shadow-none p-0 pr-1"
                            value={item.unit_price_gross || ""}
                            placeholder="0"
                            onClick={() => isTouchMode && onOpenNumpad(item.cartItemId, 'price', item.unit_price_gross || 0)}
                            readOnly={isTouchMode}
                            onChange={handlePriceChange}
                        />
                    ) : (
                        <span className="text-xs font-medium">
                            {formatCurrency(item.unit_price_gross)}
                        </span>
                    )}
                    <span className="text-[9px] text-muted-foreground leading-none">
                        Neto: {formatCurrency(item.unit_price_net)}
                    </span>
                </div>
            </TableCell>

            {/* Discount */}
            {showLineDiscount && (
                <TableCell className="py-2 text-right align-top">
                    <div className="flex flex-col items-end gap-1">
                        <Input
                            type="number"
                            className={cn(
                                "h-7 w-20 text-right text-xs bg-background border-none focus-visible:ring-1 focus-visible:ring-primary shadow-none p-0 pr-1",
                                (item.discount_amount || 0) > 0 && "text-primary font-bold"
                            )}
                            value={item.discount_amount || ""}
                            placeholder="Dscto"
                            onClick={() => isTouchMode && onOpenNumpad(item.cartItemId, 'discount', item.discount_amount || 0)}
                            readOnly={isTouchMode}
                            onChange={handleDiscountChange}
                        />
                        {(item.discount_percentage || 0) > 0 && (
                            <span className="text-[9px] text-primary font-medium leading-none">
                                -{item.discount_percentage?.toFixed(1)}%
                            </span>
                        )}
                    </div>
                </TableCell>
            )}

            {/* Total */}
            <TableCell className="py-2 text-right align-top">
                <div className="flex flex-col items-end gap-1">
                    <span className="text-sm font-bold text-primary">
                        {formatCurrency(item.total_gross)}
                    </span>
                    <span className="text-[9px] text-muted-foreground leading-none">
                        Neto: {formatCurrency(item.total_net)}
                    </span>
                </div>
            </TableCell>

            {/* Actions */}
            <TableCell className="py-2 align-top">
                {posMode === 'SHOPPING' && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                        <DataCell.Action
                            action="delete"
                            compact={!isTouchPOS}
                            onClick={() => onRemove(item.cartItemId)}
                        />
                    </div>
                )}
            </TableCell>
        </TableRow>
    )
}

// 🚀 Memoize to prevent re-renders when item props haven't changed
export const CartItem = memo(CartItemComponent, (prevProps, nextProps) => {
    return (
        prevProps.item === nextProps.item &&
        prevProps.maxQty === nextProps.maxQty &&
        prevProps.onQuantityChange === nextProps.onQuantityChange &&
        prevProps.showLineDiscount === nextProps.showLineDiscount &&
        prevProps.posMode === nextProps.posMode
    )
})
