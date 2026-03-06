"use client"

// CartItem Component
// Individual cart item row with inline editing

import { useState } from 'react'
import { memo } from 'react'
import { Trash2 } from 'lucide-react'
import { TableRow, TableCell } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/currency'
import { PricingUtils } from '@/lib/pricing'
import { useDeviceContext, MIN_TOUCH_TARGET } from '@/hooks/useDeviceContext'
import type { CartItem as CartItemType, Product, UoM } from '@/types/pos'

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
    showLineDiscount
}: CartItemProps) {
    const { isTouchPOS } = useDeviceContext()
    const itemUom = uoms.find(u => u.id === item.uom)

    // Determine allowed UoMs
    let allowedUoMs: UoM[] = []
    if (originalProduct && (originalProduct as any).allowed_sale_uoms?.length > 0) {
        const allowedIds = (originalProduct as any).allowed_sale_uoms
        const saleUoMId = (originalProduct as any).sale_uom
        allowedUoMs = uoms.filter(u => allowedIds.includes(u.id) || u.id === saleUoMId)
    } else if (itemUom) {
        allowedUoMs = uoms.filter(u => u.category === itemUom.category)
    }

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
                    <span className="font-bold text-xs truncate max-w-[150px]" title={item.name}>
                        {item.name}
                    </span>
                    <div className="flex flex-wrap gap-1">
                        {item.internal_code && (
                            <Badge variant="outline" className="text-[8px] h-3 px-1 font-normal opacity-70 uppercase">
                                {item.internal_code}
                            </Badge>
                        )}
                        {item.code && item.code !== item.internal_code && (
                            <Badge variant="secondary" className="text-[8px] h-3 px-1 font-normal opacity-70 uppercase">
                                {item.code}
                            </Badge>
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
                            isOverLimit && "text-red-600 bg-red-50 rounded"
                        )}
                        value={item.qty}
                        onChange={(e) => onQuantityChange(item.cartItemId, e.target.value)}
                        onClick={() => onOpenNumpad(item.cartItemId, 'qty', item.qty)}
                        readOnly
                        min="0.01"
                    />
                    {maxQty !== undefined && maxQty !== Infinity && (
                        <Badge
                            variant="secondary"
                            className={cn(
                                "text-[8px] px-1 h-3.5 bg-muted text-muted-foreground hover:bg-muted font-normal border-0 whitespace-nowrap",
                                isOverLimit && "text-red-600 bg-red-50"
                            )}
                        >
                            MAX: {maxQty}
                        </Badge>
                    )}
                </div>
            </TableCell>

            {/* UoM */}
            <TableCell className="py-2 align-top">
                <div className="flex justify-center">
                    {allowedUoMs.length > 1 ? (
                        <Select
                            value={item.uom?.toString()}
                            onValueChange={handleUomChange}
                        >
                            <SelectTrigger className="h-6 text-[10px] w-auto border-none bg-muted/50 py-0 px-2 min-h-0 focus:ring-0">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {allowedUoMs.map(u => (
                                    <SelectItem key={u.id} value={u.id.toString()} className="text-[10px]">
                                        {u.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                            onClick={() => onOpenNumpad(item.cartItemId, 'price', item.unit_price_gross || 0)}
                            readOnly
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
                                (item.discount_amount || 0) > 0 && "text-blue-600 font-bold"
                            )}
                            value={item.discount_amount || ""}
                            placeholder="Dscto"
                            onClick={() => onOpenNumpad(item.cartItemId, 'discount', item.discount_amount || 0)}
                            readOnly
                            onChange={handleDiscountChange}
                        />
                        {(item.discount_percentage || 0) > 0 && (
                            <span className="text-[9px] text-blue-600 font-medium leading-none">
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
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                        "opacity-0 group-hover:opacity-100 transition-opacity",
                        // Touch-friendly sizing
                        isTouchPOS ? "h-10 w-10" : "h-6 w-6"
                    )}
                    onClick={() => onRemove(item.cartItemId)}
                >
                    <Trash2 className={cn(
                        "text-destructive",
                        isTouchPOS ? "h-5 w-5" : "h-3 w-3"
                    )} />
                </Button>
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
        prevProps.showLineDiscount === nextProps.showLineDiscount
    )
})
