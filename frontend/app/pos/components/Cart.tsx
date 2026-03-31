"use client"

// Cart Component
// Shopping cart display with totals and actions

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableHead, TableHeader, TableRow, TableCell } from '@/components/ui/table'
import { ShoppingCart, Zap, Clock, User, FileText, Truck, Calendar, Edit } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CartItem } from './CartItem'
import { formatCurrency } from '@/lib/currency'
import { useDeviceContext } from '@/hooks/useDeviceContext'
import type { CartItem as CartItemType, Product, UoM } from '@/types/pos'
import type { WizardState } from '../contexts/POSContext'
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
    onConfirmSale,
    totalDiscountAmount = 0,
    onTotalDiscountChange,
    posMode = 'SHOPPING',
    wizardState
}: CartProps) {
    const { isTouchPOS } = useDeviceContext()
    const { canApplyLineDiscount, canApplyGlobalDiscount } = useSalesSettings()

    const showLineDiscounts = canApplyLineDiscount
    const showTotalDiscounts = canApplyGlobalDiscount

    const customerName = wizardState?.selectedCustomerName || "Cliente General"
    const dteType = wizardState?.dteData?.type
    const deliveryType = wizardState?.deliveryData?.type
    const deliveryDate = wizardState?.deliveryData?.date

    const getDteLabel = (type: string) => {
        switch (type) {
            case 'BOLETA': return 'Boleta'
            case 'FACTURA': return 'Factura'
            case 'BOLETA_EXENTA': return 'Boleta Exenta'
            case 'FACTURA_EXENTA': return 'Factura Exenta'
            case 'NONE': return 'Sin Documento'
            default: return type
        }
    }

    const getDeliveryLabel = (type: string) => {
        switch (type) {
            case 'IMMEDIATE': return 'Inmediata'
            case 'PARTIAL': return 'Parcial'
            case 'LATER': return 'Programada'
            default: return type
        }
    }

    return (
        <Card className="flex-1 flex flex-col overflow-hidden border bg-background/50 shadow-sm">
            <CardContent className="p-0 flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 pt-4 pb-4 border-b bg-background/50 flex flex-col justify-center rounded-t-xl h-[88px] shrink-0 gap-1.5">
                    <div className="flex justify-between items-center">
                        <span className="font-bold text-xl tracking-tight">Resumen de Venta</span>
                        <div className="flex items-center gap-2">
                             {currentDraftId && (
                                <Badge variant="outline" className="text-[10px] h-5 px-2 bg-primary/5 font-bold text-primary uppercase tracking-tighter border-primary/20 gap-1 font-mono">
                                    #{currentDraftId}
                                </Badge>
                            )}
                            <span className="text-[10px] font-black bg-primary text-primary-foreground px-2 py-0.5 rounded-md uppercase tracking-tighter">
                                {items.length} Items
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            {lastSaved && (
                                <div className="flex items-center text-[10px] text-muted-foreground font-medium gap-1 opacity-80">
                                    <Clock className="h-3 w-3" />
                                    <span>
                                        {saving ? "Guardando..." : `Sincronizado: ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                                    </span>
                                </div>
                            )}
                        </div>
                        {saving && <div className="h-1 w-12 bg-primary/20 rounded-full overflow-hidden"><div className="h-full bg-primary animate-progress-buffer w-1/3"></div></div>}
                    </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-auto bg-background/50 rounded-b-xl relative scrollbar-thin">
                    {items.length === 0 ? (
                        /* Empty State ... */
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
                        /* Table Content ... */
                        <Table>
                            <TableHeader className="bg-background/50 sticky top-0 z-10">
                                <TableRow className="hover:bg-transparent shadow-[0_1px_0_hsl(var(--border)_/_0.5)] border-0">
                                    <TableHead className={cn("text-xs py-2 h-[34px]", showLineDiscounts ? "w-[20%]" : "w-[25%]")}>Producto</TableHead>
                                    <TableHead className="w-[12%] text-xs py-2 text-center h-[34px]">Cant.</TableHead>
                                    <TableHead className="w-[13%] text-xs py-2 text-center h-[34px]">Unidad</TableHead>
                                    <TableHead className="w-[15%] text-xs py-2 text-right h-[34px]">Precio Unit.</TableHead>
                                    {showLineDiscounts && (
                                        <TableHead className="w-[15%] text-xs py-2 text-right text-primary/80 h-[34px]">Dscto.</TableHead>
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
                                            posMode={posMode}
                                        />
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {/* Footer with Totals and Actions */}
                <div className="p-4 bg-muted/20 border-t space-y-4">
                    {/* Sale Metadata Summary (New Section) */}
                    {(customerName || dteType || deliveryType) && items.length > 0 && (
                        <div className="flex flex-col gap-2 p-3 bg-background/50 rounded-lg border border-primary/10 animate-in fade-in slide-in-from-bottom-2 duration-500">
                            <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-1.5 text-muted-foreground uppercase font-bold tracking-tight">
                                    <User className="h-3 w-3 text-primary" />
                                    <span>Cliente</span>
                                </div>
                                <span className="font-bold text-primary truncate max-w-[180px]">{customerName}</span>
                            </div>

                            {dteType && (
                                <div className="flex items-center justify-between text-[11px] animate-in slide-in-from-left-2">
                                    <div className="flex items-center gap-1.5 text-muted-foreground uppercase font-bold tracking-tight">
                                        <FileText className="h-3 w-3 text-primary" />
                                        <span>Documento</span>
                                    </div>
                                    <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-bold bg-blue-50 text-primary border-blue-100 uppercase">
                                        {getDteLabel(dteType)}
                                    </Badge>
                                </div>
                            )}

                            {deliveryType && (
                                <div className="flex items-center justify-between text-[11px] animate-in slide-in-from-left-4">
                                    <div className="flex items-center gap-1.5 text-muted-foreground uppercase font-bold tracking-tight">
                                        <Truck className="h-3 w-3 text-emerald-500" />
                                        <span>Logística</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Badge variant="secondary" className="h-4 px-1.5 text-[9px] font-bold bg-emerald-50 text-emerald-700 border-emerald-100 uppercase">
                                            {getDeliveryLabel(deliveryType)}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-1 font-mono font-medium">
                                            <Calendar className="h-3 w-3" />
                                            {deliveryDate ? new Date(deliveryDate).toLocaleDateString() : new Date().toLocaleDateString()}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Status Bar removed from here */}

                    {posMode === 'SHOPPING' && (
                        /* Quick Sale Button */
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
                    )}

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
                        
                        {/* Line Discounts (Sum of all per-item discounts) */}
                        {(totals.line_discount_total || 0) > 0 && (
                            <div className="flex justify-between text-sm text-muted-foreground/80 italic">
                                <span>Descuentos por Línea</span>
                                <span>-{formatCurrency(totals.line_discount_total || 0)}</span>
                            </div>
                        )}

                        {/* Global Discount (Editable) */}
                        {(showTotalDiscounts || (totals.global_discount_total || 0) > 0) && (
                            <div
                                className={cn(
                                    "flex justify-between items-center transition-all duration-200 rounded-lg p-1.5 -mx-1.5",
                                    showTotalDiscounts 
                                        ? "cursor-pointer hover:bg-blue-50/50 group" 
                                        : "text-muted-foreground"
                                )}
                                onClick={() => showTotalDiscounts && onOpenNumpad('cart', 'discount', totalDiscountAmount || 0)}
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                        "text-sm font-medium",
                                        showTotalDiscounts ? "text-primary" : "text-muted-foreground"
                                    )}>
                                        Descuento Global
                                    </span>
                                    {showTotalDiscounts && (
                                        <Edit className="h-3 w-3 text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    )}
                                </div>
                                <div className={cn(
                                    "font-mono text-sm px-2 py-1 rounded border border-dashed transition-colors",
                                    (totals.global_discount_total || 0) > 0 
                                        ? "text-primary bg-blue-50/50 border-blue-200" 
                                        : "text-muted-foreground/40 border-muted-foreground/20 group-hover:border-blue-200 group-hover:text-blue-400"
                                )}>
                                    {(totals.global_discount_total || 0) > 0 
                                        ? `-${formatCurrency(totals.global_discount_total || 0)}` 
                                        : showTotalDiscounts ? "Añadir..." : "$0"
                                    }
                                </div>
                            </div>
                        )}

                        <div className="flex justify-between text-xl font-bold pt-2 border-t">
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
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
