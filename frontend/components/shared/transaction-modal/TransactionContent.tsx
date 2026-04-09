"use client"

import React, { Fragment } from "react"
import { Plus } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatCurrency, translatePaymentMethod } from "@/lib/utils"
import { RelatedDocumentsSection } from "./RelatedDocumentsSection"
import type { TransactionType, TransactionData } from "@/types/transactions"

export interface TransactionContentProps {
    type: TransactionType
    data: TransactionData
    view?: 'details' | 'history' | 'all'
    navigateTo: (type: TransactionType, id: number | string) => void
}

export function TransactionContent({
    type,
    data,
    view,
    navigateTo
}: TransactionContentProps) {

    const renderLinesItemDetail = () => {
        if (type === 'payment' || type === 'cash_movement') {
            return (
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-6">Concepto</TableHead>
                            <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[160px]">Método</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[180px] px-6">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        <TableRow className="hover:bg-muted/5 border-border/40">
                            <TableCell className="px-6 py-4">
                                <div className="flex flex-col">
                                    <span className="font-bold text-[13px] tracking-tight">
                                        {type === 'payment'
                                            ? (data.payment_type === 'INBOUND' ? 'Ingreso de Efectivo' : 'Egreso de Efectivo')
                                            : data.movement_type === 'DEPOSIT' ? 'Depósito'
                                                : data.movement_type === 'WITHDRAWAL' ? 'Retiro' : 'Traspaso'
                                        }
                                    </span>
                                    <span className="text-[9px] font-mono text-muted-foreground uppercase mt-0.5">
                                        {data.reference || data.transaction_number || '-'}
                                    </span>
                                </div>
                            </TableCell>
                            <TableCell className="text-center font-black text-[11px] uppercase text-muted-foreground">
                                {type === 'payment'
                                    ? translatePaymentMethod(data.payment_method)
                                    : type === 'cash_movement'
                                        ? (data.from_container_name ? `${data.from_container_name} → ${data.to_container_name}` : 'Efectivo')
                                        : '-'
                                }
                            </TableCell>
                            <TableCell className="text-right font-black text-lg text-emerald-600 font-mono tracking-tighter px-6">
                                {formatCurrency(data.amount)}
                            </TableCell>
                        </TableRow>
                    </TableBody>
                </Table>
            )
        }

        if (type === 'journal_entry') {
            return (
                <Table>
                    <TableHeader className="bg-muted/30 backdrop-blur-sm">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-6">Cuenta Contable</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12">Glosa</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[160px]">Debe</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[160px] px-6">Haber</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(data.items || []).map((item, idx: number) => (
                            <TableRow key={item.id || idx} className="hover:bg-muted/5 transition-colors border-border/40">
                                <TableCell className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-[13px] tracking-tight">{item.account_name}</span>
                                        <span className="text-[9px] font-mono text-muted-foreground tracking-widest uppercase font-bold mt-0.5">{item.account_code}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-xs italic text-muted-foreground leading-snug">{item.label || '-'}</TableCell>
                                <TableCell className="text-right font-black text-[13px] text-primary font-mono tracking-tighter">{Number(item.debit) > 0 ? formatCurrency(item.debit) : '-'}</TableCell>
                                <TableCell className="text-right font-black text-[13px] text-emerald-600 font-mono tracking-tighter px-6">{Number(item.credit) > 0 ? formatCurrency(item.credit) : '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )
        }

        if (type === 'sale_delivery' || type === 'purchase_receipt') {
            return (
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow className="hover:bg-transparent border-none">
                            <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-6">Producto</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[140px]">Cantidad</TableHead>
                            <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[100px]">UOM</TableHead>
                            <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[140px] px-6">Tipo</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {(data.lines || []).map((line) => {
                            const isExit = type === 'sale_delivery';
                            return (
                                <TableRow key={line.id} className="hover:bg-muted/5 border-border/40">
                                    <TableCell className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-[13px] tracking-tight">{line.product_name}</span>
                                            <span className="text-[9px] font-mono text-muted-foreground uppercase">{line.product_code}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-black text-lg text-primary font-mono tracking-tighter">
                                        {Number(line.quantity).toLocaleString()}
                                    </TableCell>
                                    <TableCell className="text-center font-black text-[10px] uppercase text-muted-foreground/60">
                                        {line.uom_name || 'UN'}
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-[11px] uppercase px-6">
                                        {isExit ? (
                                            <span className="text-warning bg-warning/10 px-2 py-1 rounded-md">Salida</span>
                                        ) : (
                                            <span className="text-success bg-success/10 px-2 py-1 rounded-md">Entrada</span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            )
        }

        // Default item list (invoices, orders)
        return (
            <Table>
                <TableHeader className="bg-muted/30">
                    <TableRow className="hover:bg-transparent border-none">
                        <TableHead className="text-[10px] font-black uppercase tracking-widest h-12 px-6">Descripción del Producto</TableHead>
                        <TableHead className="text-center text-[10px] font-black uppercase tracking-widest h-12 w-[80px]">Cant.</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[120px]">P. Unit.</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[120px]">Descuento</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest h-12 w-[140px] px-6">Subtotal</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {(data.lines || data.items || []).map((item, idx: number) => {
                        const hasLineDiscount = parseFloat(String(item.discount_amount || 0)) > 0
                        return (
                            <Fragment key={item.id || idx}>
                                <TableRow className="hover:bg-muted/5 border-border/40">
                                    <TableCell className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="font-bold text-[13px] tracking-tight leading-tight">{item.description || item.product_name}</span>
                                            <span className="text-[9px] font-mono text-muted-foreground uppercase mt-0.5">{item.product_code}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center font-bold text-[13px] font-mono">{Math.round(parseFloat(String(item.quantity || 0)))}</TableCell>
                                    <TableCell className="text-right font-semibold text-[12px] text-muted-foreground font-mono">{formatCurrency(item.unit_price_gross || item.unit_price || item.unit_cost)}</TableCell>
                                    <TableCell className="text-right font-semibold text-[12px] text-muted-foreground font-mono">
                                        {hasLineDiscount ? (
                                            <span className="text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-sm">
                                                -{formatCurrency(item.discount_amount)}
                                            </span>
                                        ) : '-'}
                                    </TableCell>
                                    <TableCell className="text-right font-black text-[14px] text-primary font-mono tracking-tighter px-6">
                                        {formatCurrency(item.subtotal)}
                                    </TableCell>
                                </TableRow>
                            </Fragment>
                        )
                    })}
                </TableBody>
            </Table>
        )
    }

    const renderTotals = () => {
        if (type !== 'sale_order' && type !== 'invoice') return null

        const lines = data.lines || data.items || []
        const itemsSum = lines.reduce((acc: number, item) => acc + parseFloat(String(item.subtotal || "0")), 0)
        const lineDiscountsSum = lines.reduce((acc: number, item) => acc + parseFloat(String(item.discount_amount || "0")), 0)
        const globalDiscount = parseFloat(String(data.total_discount_amount || "0"))

        return (
            <div className="flex justify-end pt-4">
                <div className="w-full md:w-80 space-y-3 bg-muted/30 p-6 rounded-lg border border-border/40">
                    <div className="flex justify-between items-center text-xs font-bold text-muted-foreground uppercase tracking-wider">
                        <span>Suma de Productos:</span>
                        <span className="font-mono text-primary">{formatCurrency(itemsSum + lineDiscountsSum)}</span>
                    </div>

                    {lineDiscountsSum > 0 && (
                        <div className="flex justify-between items-center text-xs font-bold text-primary/70 uppercase tracking-wider italic">
                            <span>Descuentos por Línea:</span>
                            <span className="font-mono">-{formatCurrency(lineDiscountsSum)}</span>
                        </div>
                    )}

                    {globalDiscount > 0 && (
                        <div className="flex justify-between items-center text-xs font-bold text-destructive uppercase tracking-wider bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                            <div className="flex items-center gap-2">
                                <Plus className="h-3 w-3 rotate-45" />
                                <span>Descuento Global:</span>
                            </div>
                            <span className="font-mono">-{formatCurrency(globalDiscount)}</span>
                        </div>
                    )}

                    <div className="pt-2 border-t border-border/60 space-y-2">
                        <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                            <span>Neto:</span>
                            <span className="font-mono">{formatCurrency(data.total_net)}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-black text-muted-foreground/60 uppercase tracking-widest">
                            <span>IVA (19%):</span>
                            <span className="font-mono">{formatCurrency(data.total_tax)}</span>
                        </div>
                    </div>

                    <div className="pt-3 border-t-2 border-primary/20 flex justify-between items-center group">
                        <span className="text-sm font-black text-primary uppercase tracking-tighter">Total a Pagar:</span>
                        <span className="text-2xl font-black text-primary font-mono tracking-tighter group-hover:scale-105 transition-transform origin-right">
                            {formatCurrency(data.total)}
                        </span>
                    </div>
                </div>
            </div>
        )
    }

    const renderCashMovementFlow = () => {
        if (type !== 'cash_movement') return null

        return (
            <div className="space-y-6">
                <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2.5">
                    <div className="h-8 w-1 bg-primary rounded-full" />
                    Flujo de Fondos
                </h3>
                <div className="bg-muted/30 p-8 rounded-lg border border-dashed flex items-center justify-between gap-6 font-medium">
                    <div className="flex-1 text-center space-y-2">
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Origen</div>
                        <div className="font-black text-lg truncate px-2 text-primary tracking-tight">
                            {data.from_container_name || (data.movement_type === 'DEPOSIT' ? 'Exterior' : '-')}
                        </div>
                    </div>

                    <div className="flex flex-col items-center flex-shrink-0 text-muted-foreground">
                        <span className="text-[9px] font-black tracking-[0.2em] uppercase mb-2 opacity-40">
                            {data.movement_type === 'TRANSFER' ? 'TRASPASO' : data.movement_type === 'DEPOSIT' ? 'ENTRADA' : 'SALIDA'}
                        </span>
                        <div className="h-[2px] w-24 bg-gradient-to-r from-transparent via-border to-transparent relative">
                            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2 h-2 border-t-2 border-r-2 border-border rotate-45 transform" />
                        </div>
                    </div>

                    <div className="flex-1 text-center space-y-2">
                        <div className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">Destino</div>
                        <div className="font-black text-lg truncate px-2 text-primary tracking-tight">
                            {data.to_container_name || (data.movement_type === 'WITHDRAWAL' ? 'Exterior' : '-')}
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 overflow-y-auto p-8 lg:p-12 space-y-12">
            {(view === 'all' || view === 'details') && (
                <div className="space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black uppercase tracking-tighter flex items-center gap-2.5">
                            <div className="h-8 w-1 bg-primary rounded-full" />
                            Detalle de Ítems
                        </h3>
                    </div>

                    <div className="border border-border/60 rounded-lg overflow-hidden bg-background shadow-sm">
                        {renderLinesItemDetail()}
                    </div>

                    {renderTotals()}
                </div>
            )}

            {(view === 'all' || view === 'details') && renderCashMovementFlow()}

            {(view === 'all' || view === 'details') && (
                <RelatedDocumentsSection
                    currentType={type as any}
                    data={data as any}
                    navigateTo={navigateTo}
                />
            )}
        </div>
    )
}
