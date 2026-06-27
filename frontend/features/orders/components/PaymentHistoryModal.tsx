"use client"

import { BaseModal, DataCell, DataTable } from '@/components/shared'
import { formatCurrency } from "@/lib/money"
import { Landmark, User, Hash, FileText } from "lucide-react"
import { formatEntityDisplay } from "@/lib/entity-registry"
import type { TransactionData } from "@/types/transactions"
import type { ColumnDef } from "@tanstack/react-table"

interface Payment {
    id: number
    amount: number
    payment_method: string
    payment_method_display: string
    date: string
    reference?: string
    transaction_number?: string
    partner_name?: string
    created_by_name?: string
}

interface PaymentHistoryModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    order: TransactionData
}

export function PaymentHistoryModal({
    open,
    onOpenChange,
    order
}: PaymentHistoryModalProps) {
    const orderRec = order as Record<string, unknown>; const payments = (orderRec['serialized_payments'] ?? (orderRec['related_documents'] as Record<string, unknown> | undefined)?.['payments'] ?? []) as Payment[]

    const columns: ColumnDef<Payment>[] = [
        {
            header: "Fecha",
            cell: ({ row }) => (
                <div className="flex flex-col gap-0.5">
                    <DataCell.Date value={row.original.date} />
                    {row.original.created_by_name && (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <User className="h-3 w-3" /> {row.original.created_by_name}
                        </span>
                    )}
                </div>
            ),
        },
        {
            header: "Método de Pago",
            cell: ({ row }) => (
                <DataCell.Chip intent="primary">{row.original.payment_method_display || row.original.payment_method}</DataCell.Chip>
            ),
        },
        {
            header: "Referencia / N° Op",
            cell: ({ row }) => {
                const p = row.original
                return (
                    <div className="flex flex-col gap-1">
                        {p.reference && (
                            <span className="text-xs font-medium flex items-center gap-1">
                                <FileText className="h-3 w-3 text-muted-foreground" /> {p.reference}
                            </span>
                        )}
                        {p.transaction_number && (
                            <span className="text-xs font-black text-success flex items-center gap-1">
                                <Hash className="h-3 w-3" /> {p.transaction_number}
                            </span>
                        )}
                        {!p.reference && !p.transaction_number && (
                            <span className="text-[10px] text-muted-foreground italic">Sin referencias</span>
                        )}
                    </div>
                )
            },
        },
        {
            header: "Monto",
            cell: ({ row }) => (
                <DataCell.Currency value={row.original.amount} />
            ),
        },
    ]

    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="xl"
            title={
                <div className="flex items-center gap-2 text-xl font-bold">
                    <Landmark className="h-6 w-6 text-primary" />
                    Historial de Pagos y Referencias - {order.number ? formatEntityDisplay(order.document_type === 'PURCHASE_ORDER' ? 'purchasing.purchaseorder' : 'sales.saleorder', order) : 'Borrador'}
                </div>
            }
        >
            <div className="flex flex-col mt-4">
                <DataTable
                    columns={columns}
                    data={payments}
                    variant="embedded"
                    hidePagination
                    emptyState={{
                        icon: Landmark,
                        title: "No se han registrado pagos aún.",
                        description: "Los pagos asociados a esta orden aparecerán aquí.",
                        context: "search",
                    }}
                />

                {payments.length > 0 && (
                    <div className="mt-4 p-4 rounded-md bg-primary/5 flex justify-between items-center border border-primary/10">
                        <span className="text-sm font-medium">Total Pagado:</span>
                        <span className="text-lg font-bold text-primary">
                            {formatCurrency(payments.reduce((acc: number, p: Payment) => acc + parseFloat(String(p.amount)), 0))}
                        </span>
                    </div>
                )}
            </div>
        </BaseModal>
    )
}
