"use client"

import React from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Banknote, Eye, SplitSquareHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatPlainDate, translatePaymentMethod, formatCurrency } from "@/lib/utils"
import type { TransactionData, TransactionType } from "@/types/transactions"

type PaymentEntry = {
    id: number
    date?: string
    created_at?: string
    payment_method?: string
    journal_name?: string
    transaction_number?: string
    reference?: string
    amount?: number | string
    is_partial_allocation?: boolean
    allocated_amount?: number | string
    allocation_notes?: string
}

export const PaymentHistorySection = React.memo(({ data, currentType, navigateTo, handleDeletePayment }: { data: TransactionData, currentType: TransactionType, navigateTo: (type: TransactionType, id: number | string) => void, handleDeletePayment: (id: number) => void }) => {
    const payments = (data?.serialized_payments || data?.payments_detail || []) as PaymentEntry[];
    if (payments.length === 0) return null;

    return (
        <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-success">
                <Banknote className="h-5 w-5" />
                Historial de Pagos
            </h3>
            <div className="border rounded-lg overflow-hidden bg-background shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/10">
                        <TableRow className="hover:bg-transparent tracking-widest text-[10px] font-black uppercase">
                            <TableHead className="h-10">Fecha</TableHead>
                            <TableHead className="h-10">Método / Referencia</TableHead>
                            <TableHead className="text-right h-10 w-[140px]">Aplicado</TableHead>
                            <TableHead className="text-right h-10 w-[80px]">Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((pay) => {
                            const displayAmount = pay.is_partial_allocation
                                ? pay.allocated_amount
                                : pay.amount
                            return (
                                <TableRow key={`${pay.id}-${pay.is_partial_allocation}`} className="hover:bg-muted/10 transition-colors">
                                    <TableCell className="text-xs font-semibold">{formatPlainDate(pay.date || pay.created_at)}</TableCell>
                                    <TableCell>
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold uppercase">{translatePaymentMethod(pay.payment_method || pay.journal_name)}</span>
                                                {pay.is_partial_allocation && (
                                                    <Badge variant="secondary" className="h-4 px-1 text-xs font-bold gap-0.5">
                                                        <SplitSquareHorizontal className="h-2.5 w-2.5" />
                                                        Parcial
                                                    </Badge>
                                                )}
                                            </div>
                                            <span className="text-xs font-mono text-muted-foreground">
                                                {pay.transaction_number || pay.reference || '-'}
                                            </span>
                                            {pay.is_partial_allocation && pay.allocation_notes && (
                                                <span className="text-xs text-muted-foreground italic">{pay.allocation_notes}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex flex-col items-end">
                                            <span className="font-black text-sm text-success">{formatCurrency(displayAmount)}</span>
                                            {pay.is_partial_allocation && pay.amount !== pay.allocated_amount && (
                                                <span className="text-xs text-muted-foreground">de {formatCurrency(pay.amount)}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-1">
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-primary rounded-lg hover:bg-primary/5" onClick={() => navigateTo('payment', pay.id)}>
                                                <Eye className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
})

PaymentHistorySection.displayName = "PaymentHistorySection"
