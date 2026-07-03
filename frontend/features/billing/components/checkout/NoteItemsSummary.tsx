"use client"

import { Separator } from "@/components/ui/separator"
import { Chip, EmptyState } from '@/components/shared'
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { ShoppingBag } from "lucide-react"

import { formatCurrency } from "@/lib/money"
import { cn } from "@/lib/utils"

import type { NoteLineItem } from "@/features/notes"

interface NoteItemsSummaryProps {
    items: NoteLineItem[]
    totalNet: number
    totalTax: number
    total: number
    isExempt?: boolean
}

export function NoteItemsSummary({
    items,
    totalNet,
    totalTax,
    total,
    isExempt = false
}: NoteItemsSummaryProps) {

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
                            {items.filter(item => item.noteQuantity > 0).length === 0 ? (
                                <EmptyState context="inventory" variant="compact" title="Sin productos seleccionados" />
                            ) : (
                                items.filter(item => item.noteQuantity > 0).map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-start gap-4 animate-in fade-in duration-500">
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <p className="font-bold text-[13px] leading-tight text-foreground/90 truncate mr-2">
                                                        {item.productName || `Producto ${item.productId}`}
                                                    </p>
                                                </TooltipTrigger>
                                                <TooltipContent side="top">{item.productName || `Producto ${item.productId}`}</TooltipContent>
                                            </Tooltip>
                                            <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                                                <Chip size="xs" intent="neutral" className="bg-muted">
                                                    {item.noteQuantity} {item.uomName || 'un'}
                                                </Chip>
                                                {item.reason && (
                                                    <Chip size="xs" intent="neutral" className="h-3 px-1 font-normal opacity-70 italic truncate max-w-[120px]">
                                                        {item.reason}
                                                    </Chip>
                                                )}
                                            </div>
                                        </div>
                                        <p className="font-mono text-xs font-black whitespace-nowrap pt-0.5">
                                            {formatCurrency(item.noteUnitPrice * item.noteQuantity)}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-background border-t shadow-[0_-4px_20px_-10px_oklch(0.12_0.02_240_/_0.1)] space-y-3">
                <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                    <span>Subtotal Neto</span>
                    <span className="whitespace-nowrap font-mono">{formatCurrency(totalNet)}</span>
                </div>
                {(totalTax > 0 || isExempt) && (
                    <div className="flex justify-between text-xs font-bold text-muted-foreground/80">
                        <span>IVA {isExempt ? "(0% Exento)" : "(19%)"}</span>
                        <span className={cn("whitespace-nowrap font-mono", isExempt && "opacity-40")}>
                            {formatCurrency(totalTax)}
                        </span>
                    </div>
                )}

                <Separator className="my-2 opacity-50" />
                <div className="flex justify-between items-center pt-1">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Total Ajuste</span>
                    <span className="text-2xl font-black text-primary tracking-tighter whitespace-nowrap">
                        {formatCurrency(total)}
                    </span>
                </div>
            </div>
        </div>
    )
}

