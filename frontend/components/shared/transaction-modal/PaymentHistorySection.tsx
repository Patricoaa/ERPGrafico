"use client"

import React from "react"
import { formatCurrency } from "@/lib/money"
import { DataTable } from "@/components/shared"
import { Badge } from "@/components/ui/badge"
import { Banknote, SplitSquareHorizontal } from "lucide-react"
import { DataCell } from "@/components/shared/DataTableCells"
import { formatPlainDate, translatePaymentMethod } from "@/lib/utils"
import type { TransactionData, TransactionType } from "@/types/transactions"
import type { ColumnDef } from "@tanstack/react-table"

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

    const columns: ColumnDef<PaymentEntry>[] = [
        {
            header: "Fecha",
            accessorKey: "date",
            cell: ({ row }) => (
                <span className="text-xs font-semibold">
                    {formatPlainDate(row.original.date || row.original.created_at)}
                </span>
            ),
        },
        {
            header: "Método / Referencia",
            id: "method_reference",
            cell: ({ row }) => {
                const pay = row.original
                return (
                    <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold uppercase">
                                {translatePaymentMethod(pay.payment_method || pay.journal_name)}
                            </span>
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
                )
            },
        },
        {
            header: "Aplicado",
            id: "amount",
            cell: ({ row }) => {
                const pay = row.original
                const displayAmount = pay.is_partial_allocation ? pay.allocated_amount : pay.amount
                return (
                    <div className="flex flex-col items-end">
                        <span className="font-black text-sm text-success">{formatCurrency(displayAmount)}</span>
                        {pay.is_partial_allocation && pay.amount !== pay.allocated_amount && (
                            <span className="text-xs text-muted-foreground">de {formatCurrency(pay.amount)}</span>
                        )}
                    </div>
                )
            },
            meta: { align: "right" as const },
        },
        {
            header: "Acción",
            id: "actions",
            cell: ({ row }) => (
                <DataCell.ActionGroup className="justify-end">
                    <DataCell.Action
                        action="view"
                        onClick={() => navigateTo("payment", row.original.id)}
                    />
                </DataCell.ActionGroup>
            ),
            meta: { align: "right" as const },
        },
    ]

    return (
        <div className="space-y-4 pt-6 border-t">
            <h3 className="text-lg font-black uppercase tracking-tighter flex items-center gap-2 text-success">
                <Banknote className="h-5 w-5" />
                Historial de Pagos
            </h3>
            <DataTable
                columns={columns}
                data={payments}
                variant="embedded"
                hidePagination
            />
        </div>
    );
})

PaymentHistorySection.displayName = "PaymentHistorySection"
