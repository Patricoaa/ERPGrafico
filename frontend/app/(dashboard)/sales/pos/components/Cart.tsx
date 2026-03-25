"use client"

// Cart Component
// Shopping cart display with totals and actions

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { ShoppingCart, Zap, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CartItem } from './CartItem'
import { formatCurrency } from '@/lib/currency'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import type { CartItem as CartItemType, Product, UoM } from '@/types/pos'
import { useSalesSettings } from '@/features/settings'

interface CartProps {
    items: CartItemType[]
    products: Product[]
    uoms: UoM[]
    limits: Record<string, number>
    totals: {
        total_gross: number
        total_net: number
        total_tax: number
        total_discount?: number
        total_gross_before_discount?: number
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
    onConfirmSale: () => void
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
    onConfirmSale,
    totalDiscountAmount = 0,
    onTotalDiscountChange
}: CartProps) {
    const { isTouchPOS } = useDeviceContext()
    const { canApplyLineDiscount, canApplyGlobalDiscount } = useSalesSettings()

    const showLineDiscounts = canApplyLineDiscount
    const showTotalDiscounts = canApplyGlobalDiscount

    return (
        <Card className="flex-1 flex flex-col overflow-hidden border bg-background/50 shadow-sm">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-[24px] pb-4 border-b bg-background/50 flex justify-between items-start rounded-t-xl h-[88px] shrink-0">
                    <span className="font-semibold text-xl leading-none mt-1">Resumen de Venta</span>
                    <span className="text-sm font-semibold bg-primary/10 text-primary px-3 py-1 rounded-full -mt-1">
                        {items.length} items
                    </span>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-auto bg-background/50 rounded-b-xl relative">
                    {items.length === 0 ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center text-muted-foreground/60 gap-4 animate-in fade-in zoom-in duration-500">
                            <div className="h-24 w-24 rounded-full bg-muted/30 flex items-center justify-center border-2 border-dashed border-muted-foreground/10 mb-2">
                                <ShoppingCart className="h-12 w-12 text-muted-foreground/20" />
                            </div>
                            <div className="space-y-1.5">
                                <p className="font-bold text-lg text-muted-foreground/80 tracking-tight">El carrito está vacío</p>
                                <p className="max-w-[280px] text-xs italic opacity-70 mx-auto leading-relaxed">
                                    Escanea un código de barras o selecciona productos del catálogo para comenzar la venta.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-background/50 sticky top-0 z-10">
                                <TableRow className="hover:bg-transparent shadow-[0_1px_0_hsl(var(--border)_/_0.5)] border-0">
                                    <TableHead className={cn("text-xs py-2 h-[34px]", showLineDiscounts ? "w-[20%]" : "w-[25%]")}>Producto</TableHead>
                                    <TableHead className="w-[12%] text-xs py-2 text-center h-[34px]">Cant.</TableHead>
                                    <TableHead className="w-[13%] text-xs py-2 text-center h-[34px]">Unidad</TableHead>
                                    <TableHead className="w-[15%] text-xs py-2 text-right h-[34px]">Precio Unit.</TableHead>
                                    {showLineDiscounts && (
                                        <TableHead className="w-[15%] text-xs py-2 text-right text-blue-600/80 h-[34px]">Dscto.</TableHead>
                                    )}
                                    <TableHead className="w-[15%] text-xs py-2 text-right h-[34px]">Total</TableHead>
                                    <TableHead className="w-[5%] py-2 h-[34px]"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
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
                                        />
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {/* Footer with Totals and Actions */}
                <div className="p-4 bg-muted/20 border-t space-y-4">
                    {/* Status Bar */}
                    <div className="flex justify-between items-center px-1 min-h-[16px]">
                        <div>
                            {currentDraftId && (
                                <Badge variant="outline" className="text-[10px] h-4 px-1.5 bg-background font-normal text-muted-foreground uppercase tracking-widest border-muted-foreground/20 gap-1 font-mono">
                                    Borrador
                                    <span className="font-bold text-primary/70">#{currentDraftId}</span>
                                </Badge>
                            )}
                        </div>
                        {lastSaved && (
                            <div className="flex items-center text-[10px] text-muted-foreground gap-1 opacity-70">
                                <Clock className="h-3 w-3" />
                                <span>
                                    {saving ? "Guardando..." : `Actualizado: ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Quick Sale Button */}
                    <Button
                        variant="outline"
                        className={cn(
                            "w-full font-bold border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all",
                            isTouchPOS ? "h-14 text-base" : "h-12 text-sm"
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

                    {/* Totals */}
                    <div className="space-y-1">
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>Subtotal Neto</span>
                            <span>{formatCurrency(totals.total_net)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>IVA (19%)</span>
                            <span>{formatCurrency(totals.total_tax)}</span>
                        </div>
                        {(showTotalDiscounts || (totals.total_discount || 0) > 0) && (
                            <div
                                className={cn(
                                    "flex justify-between text-sm",
                                    showTotalDiscounts ? "text-blue-600 font-medium cursor-pointer hover:underline" : "text-muted-foreground"
                                )}
                                onClick={() => showTotalDiscounts && onOpenNumpad('cart', 'discount', totalDiscountAmount || 0)}
                            >
                                <span>{showTotalDiscounts ? 'Añadir Dscto. Global' : 'Descuento'}</span>
                                <span>{(totals.total_discount || 0) > 0 ? `-${formatCurrency(totals.total_discount || 0)}` : '$0'}</span>
                            </div>
                        )}
                        <div className="flex justify-between text-xl font-bold pt-2 border-t">
                            <span>Total</span>
                            <span>{formatCurrency(totals.total_gross)}</span>
                        </div>
                    </div>

                    {/* Confirm Sale Button */}
                    <Button
                        id="confirm-sale-btn"
                        className={cn(
                            "w-full shadow-lg font-black uppercase tracking-tight",
                            isTouchPOS ? "h-20 text-2xl" : "h-16 text-xl"
                        )}
                        size="lg"
                        disabled={loading || items.length === 0}
                        onClick={onConfirmSale}
                    >
                        <ShoppingCart className={cn(
                            "mr-2",
                            isTouchPOS ? "h-8 w-8" : "h-6 w-6"
                        )} />
                        {loading ? "Procesando..." : "Confirmar Venta"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}
