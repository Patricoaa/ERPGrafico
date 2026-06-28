"use client"

import { Separator } from "@/components/ui/separator"
import { ShoppingBag } from "lucide-react"
import { formatCurrency } from "@/lib/money"
import { Chip } from "@/components/shared"
import { translatePaymentMethod } from "@/lib/utils"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PricingUtils } from '@/lib/pricing-utils'

import { type SaleOrderLine } from "../../types"
import { type Contact } from "@/types/entities"

interface OrderSummaryCardProps {
    orderLines: SaleOrderLine[]
    total: number
    totalDiscountAmount?: number
    dteType?: string
    customer?: Contact
    paymentMethod?: string | null
    paymentAmount?: number
}

export function OrderSummaryCard({
    orderLines,
    total,
    totalDiscountAmount = 0,
    dteType,
    customer,
    paymentMethod,
    paymentAmount,
}: OrderSummaryCardProps) {
    const isExempt = dteType === 'FACTURA_EXENTA' || dteType === 'BOLETA_EXENTA';

    // Calculate totals
    const lineDiscounts = orderLines.reduce((acc, line) => acc + (line.discount_amount || 0), 0);
    const totalDiscount = lineDiscounts + totalDiscountAmount;
    const net = isExempt ? total : PricingUtils.grossToNet(total);
    const tax = isExempt ? 0 : PricingUtils.extractTax(total);

    return (
        <div className="h-full flex flex-col bg-muted/20 border-l">
            <div className="flex-1 overflow-auto custom-scrollbar">
                <div className="p-6 space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 flex items-center gap-2">
                            <ShoppingBag className="h-4 w-4" />
                            Detalle de Productos
                        </h3>

                        <div className="space-y-4">
                            {orderLines.map((line, idx) => (
                                <div key={idx} className="flex justify-between items-start gap-4 animate-in fade-in duration-500">
                                    <div className="space-y-1.5 flex-1 min-w-0">
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <p className="font-bold text-[13px] leading-tight text-foreground/90 truncate mr-2">
                                                    {line.product_name || line.description}
                                                </p>
                                            </TooltipTrigger>
                                            <TooltipContent side="top">{line.product_name || line.description}</TooltipContent>
                                        </Tooltip>
                                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                            {line.internal_code && (
                                                <Chip size="xs">{line.internal_code}</Chip>
                                            )}
                                            {line.code && line.code !== line.internal_code && (
                                                <Chip size="xs">{line.code}</Chip>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded leading-none">
                                                {line.qty || line.quantity} {line.uom_name || 'un'}
                                            </span>
                                            {line.product_type === 'MANUFACTURABLE' && (
                                                <Chip size="xs" intent="warning">
                                                    Fab
                                                </Chip>
                                            )}
                                        </div>
                                    </div>
                                    <p className="font-mono text-xs font-black whitespace-nowrap pt-0.5">
                                        {formatCurrency(isExempt ? PricingUtils.calculateLineNet(line.qty || line.quantity, line.unit_price_net || line.unit_price) : (line.total_gross || PricingUtils.calculateLineTotal(line.qty || line.quantity, line.unit_price_net || line.unit_price)))}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-background border-t shadow-[0_-4px_20px_-10px_oklch(0.12_0.02_240_/_0.1)] space-y-3">
                <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                    <span>Subtotal Neto</span>
                    <span className="whitespace-nowrap font-mono">{formatCurrency(net)}</span>
                </div>
                {!isExempt && (
                    <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                        <span>IVA (19%)</span>
                        <span className="whitespace-nowrap font-mono">{formatCurrency(tax)}</span>
                    </div>
                )}
                {lineDiscounts > 0 && (
                    <div className="flex justify-between text-xs font-bold text-primary/70 italic">
                        <span>Descuentos por Línea</span>
                        <span className="whitespace-nowrap font-mono">-{formatCurrency(lineDiscounts)}</span>
                    </div>
                )}
                {totalDiscountAmount > 0 && (
                    <div className="flex justify-between text-xs font-bold text-primary">
                        <span>Descuento Global</span>
                        <span className="whitespace-nowrap font-mono">-{formatCurrency(totalDiscountAmount)}</span>
                    </div>
                )}
                <Separator className="my-2 opacity-50" />
                <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Total Venta</span>
                    <span className="text-2xl font-black text-primary tracking-tighter whitespace-nowrap">
                        {formatCurrency(total)}
                    </span>
                </div>

                {!customer?.credit_blocked && (
                    <>
                        <Separator className="my-2 opacity-30" />
                        <div className="flex justify-between items-center pt-1">
                            <span className="text-xs font-bold text-muted-foreground">Crédito Disponible</span>
                            <span className={`font-mono font-bold ${Number(customer?.credit_available) < total ? 'text-destructive' : 'text-success'}`}>
                                {formatCurrency(Number(customer?.credit_available || 0))}
                            </span>
                        </div>
                    </>
                )}

                {(paymentAmount || 0) > 0 && (
                    <>
                        <Separator className="my-2 opacity-30" />
                        <div className="space-y-1.5 pt-1">
                            <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                                <span>Monto Recibido</span>
                                <span className="font-mono">{formatCurrency(paymentAmount || 0)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                                <span>Método</span>
                                <span className="font-mono">{translatePaymentMethod(paymentMethod)}</span>
                            </div>
                            {(paymentAmount || 0) !== total && (
                                <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                                    <span>{(paymentAmount || 0) > total ? 'Vuelto' : 'Crédito Asignado'}</span>
                                    <span className={cn("font-mono", (paymentAmount || 0) > total ? "text-success" : "text-warning")}>
                                        {formatCurrency(Math.abs((paymentAmount || 0) - total))}
                                    </span>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
