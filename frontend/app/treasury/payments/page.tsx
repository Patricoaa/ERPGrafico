"use client"

import { useEffect, useState } from "react"
import {
    ColumnDef,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ArrowDownLeft, ArrowUpRight, Eye, Banknote, CreditCard, Landmark, Receipt, Hash, X } from "lucide-react"
import api from "@/lib/api"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { toast } from "sonner"
import { TransactionNumberForm } from "@/components/forms/TransactionNumberForm"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell } from "@/components/ui/data-table-cells"

interface Payment {
    id: number
    payment_type: string
    payment_method: string
    payment_method_display: string
    amount: string
    date: string
    reference: string // User manual reference
    transaction_number: string // Bank/Card transaction number
    code: string // System generated ING/EGR
    partner_name: string
    journal_name: string
    document_info?: {
        type: 'invoice' | 'purchase_order' | 'sale_order'
        id: number
        number: string
        label: string
    } | null
}

export default function PaymentsPage() {
    const [payments, setPayments] = useState<Payment[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string } | null>(null)
    const [trForm, setTrForm] = useState<{ open: boolean, id: number | null, initialValue: string }>({
        open: false,
        id: null,
        initialValue: ""
    })

    const fetchPayments = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/payments/')
            setPayments(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch payments", error)
        } finally {
            setLoading(false)
        }
    }


    const handleDeletePayment = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar este pago?")) return
        try {
            await api.delete(`/treasury/payments/${id}/`)
            toast.success("Pago eliminado correctamente")
            fetchPayments()
        } catch (error: any) {
            console.error("Failed to delete payment", error)
            // If it failed because it's posted, suggest annullment? 
            // Better to handle it based on status if we have it in the frontend.
            toast.error(error.response?.data?.error || "Error al eliminar el pago")
        }
    }

    const handleAnnulPayment = async (id: number) => {
        if (!confirm("¿Está seguro de ANULAR este pago? Esta acción generará reversos contables y no se puede deshacer.")) return
        try {
            await api.post(`/treasury/payments/${id}/annul/`)
            toast.success("Pago anulado correctamente")
            fetchPayments()
        } catch (error: any) {
            console.error("Failed to annul payment", error)
            toast.error(error.response?.data?.error || "Error al anular el pago")
        }
    }

    useEffect(() => {
        fetchPayments()
    }, [])

    const columns: ColumnDef<Payment>[] = [
        {
            accessorKey: "code",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => <DataCell.Code className="font-bold">{row.getValue("code")}</DataCell.Code>,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
        },
        {
            accessorKey: "payment_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => {
                const type = row.getValue("payment_type") as string
                const isInbound = type === 'INBOUND'
                return (
                    <div className="flex justify-center">
                        <DataCell.Badge variant={isInbound ? "success" : "destructive"} className="gap-1 pl-1.5 pr-2.5">
                            {isInbound ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                            {isInbound ? "INGRESO" : "EGRESO"}
                        </DataCell.Badge>
                    </div>
                )
            },
        },
        {
            accessorKey: "amount",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Monto" />
            ),
            cell: ({ row }) => {
                const amount = parseFloat(row.getValue("amount"))
                const type = row.original.payment_type
                return <DataCell.Currency value={amount} className={type === 'INBOUND' ? "text-emerald-700 font-bold" : "text-red-700 font-bold"} />
            },
        },
        {
            accessorKey: "payment_method",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Método de Pago" />
            ),
            cell: ({ row }) => {
                const method = row.getValue("payment_method") as string
                const display = row.original.payment_method_display

                let icon = Banknote
                let color = "text-emerald-600"

                if (method === 'CARD') { icon = CreditCard; color = "text-blue-600" }
                else if (method === 'TRANSFER') { icon = Landmark; color = "text-indigo-600" }
                else if (method === 'CREDIT') { icon = Receipt; color = "text-amber-600" }

                return (
                    <div className="flex items-center gap-2">
                        <DataCell.Icon icon={icon} color={color} className="bg-transparent p-0" />
                        <span className="text-[10px] font-medium uppercase text-muted-foreground">{display}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "transaction_number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="N° Transacción" />
            ),
            cell: ({ row }) => <DataCell.Code className="max-w-[80px] truncate" title={row.getValue("transaction_number") as string}>{row.getValue("transaction_number")}</DataCell.Code>,
        },
        {
            id: "document",
            header: "Documento",
            cell: ({ row }) => {
                const payment = row.original
                const doc = payment.document_info

                if (!doc) {
                    return (
                        <div className="flex flex-col">
                            <span className="font-medium text-xs text-muted-foreground italic">{payment.reference || 'Sin Documento'}</span>
                            <DataCell.Secondary className="font-bold text-foreground">{payment.partner_name}</DataCell.Secondary>
                        </div>
                    )
                }

                const docName = doc.type === 'purchase_order' ? `OC-${doc.number}` :
                    doc.type === 'sale_order' ? `NV-${doc.number}` :
                        doc.label.includes('Crédito') ? `NC-${doc.number}` :
                            doc.label.includes('Débito') ? `ND-${doc.number}` :
                                doc.label.includes('Bol') ? `BOL-${doc.number}` :
                                    `FACT-${doc.number}`

                const docType = doc.type === 'invoice' ? (doc.label.includes('Bol') ? 'Boleta' : 'Factura') :
                    doc.type === 'purchase_order' ? 'Orden de Compra' :
                        doc.type === 'sale_order' ? 'Nota de Venta' : doc.type

                return (
                    <div className="flex flex-col">
                        <DataCell.Link onClick={() => setViewingTransaction({ type: doc.type, id: doc.id })}>
                            <div className="flex flex-col items-start leading-tight">
                                <span className="font-semibold uppercase text-[8px] text-muted-foreground">{docType}</span>
                                <span className="text-[10px]">{docName}</span>
                            </div>
                        </DataCell.Link>
                        <DataCell.Secondary className="font-bold text-foreground mt-0.5">{payment.partner_name}</DataCell.Secondary>
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: "Acción",
            cell: ({ row }) => {
                const payment = row.original
                return (
                    <div className="flex justify-center gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setViewingTransaction({ type: 'payment', id: payment.id })}
                            title="Ver Detalle"
                        >
                            <Eye className="h-4 w-4 text-blue-600" />
                        </Button>

                        {/* Logic: Show transaction button if:
                            1. OUTBOUND + (CARD or TRANSFER)
                            2. INBOUND + TRANSFER + (transaction_number is empty)
                        */}
                        {((payment.payment_type === 'OUTBOUND' && ['CARD', 'TRANSFER'].includes(payment.payment_method)) ||
                            (payment.payment_type === 'INBOUND' && payment.payment_method === 'TRANSFER' && !payment.transaction_number)) && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => setTrForm({
                                        open: true,
                                        id: payment.id,
                                        initialValue: payment.transaction_number || ""
                                    })}
                                    title="Registrar N° Transacción"
                                >
                                    <Hash className="h-4 w-4 text-orange-600" />
                                </Button>
                            )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleAnnulPayment(payment.id)}
                            title="Anular"
                        >
                            <X className="h-4 w-4 text-red-600" />
                        </Button>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Ingresos y Egresos</h2>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="text-muted-foreground">Cargando pagos...</div>
                </div>
            ) : (
                <div className="">
                    <DataTable
                        columns={columns}
                        data={payments}
                        filterColumn="code"
                        searchPlaceholder="Buscar por número..."
                        facetedFilters={[
                            {
                                column: "payment_type",
                                title: "Tipo",
                                options: [
                                    { label: "Ingreso", value: "INBOUND" },
                                    { label: "Egreso", value: "OUTBOUND" },
                                ],
                            },
                            {
                                column: "payment_method",
                                title: "Método",
                                options: [
                                    { label: "Efectivo", value: "CASH" },
                                    { label: "Tarjeta", value: "CARD" },
                                    { label: "Transferencia", value: "TRANSFER" },
                                    { label: "Crédito", value: "CREDIT" },
                                ],
                            },
                        ]}
                        useAdvancedFilter={true}
                        defaultPageSize={20}
                    />
                </div>
            )}

            {viewingTransaction && (
                <TransactionViewModal
                    open={!!viewingTransaction}
                    onOpenChange={(open) => !open && setViewingTransaction(null)}
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                />
            )}

            <TransactionNumberForm
                open={trForm.open}
                onOpenChange={(open) => setTrForm(prev => ({ ...prev, open }))}
                paymentId={trForm.id}
                initialValue={trForm.initialValue}
                onSuccess={fetchPayments}
            />
        </div>
    )
}
