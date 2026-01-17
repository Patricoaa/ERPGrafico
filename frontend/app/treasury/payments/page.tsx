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
            cell: ({ row }) => (
                <span className="font-mono text-xs font-bold">{row.getValue("code")}</span>
            ),
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => (
                <span className="text-muted-foreground">{new Date(row.getValue("date")).toLocaleDateString()}</span>
            ),
        },
        {
            accessorKey: "payment_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
            cell: ({ row }) => {
                const type = row.getValue("payment_type") as string
                return (
                    <div className="flex justify-center">
                        {type === 'INBOUND' ? (
                            <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                                <ArrowDownLeft className="h-4 w-4" />
                                <span>INGRESO</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1 text-red-600 font-bold text-xs">
                                <ArrowUpRight className="h-4 w-4" />
                                <span>EGRESO</span>
                            </div>
                        )}
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
                return (
                    <div className="text-right font-black font-mono">
                        <span className={type === 'INBOUND' ? "text-emerald-700" : "text-red-700"}>
                            ${amount.toLocaleString()}
                        </span>
                    </div>
                )
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
                return (
                    <div className="flex items-center gap-2">
                        {method === 'CASH' && <Banknote className="h-4 w-4 text-emerald-600" />}
                        {method === 'CARD' && <CreditCard className="h-4 w-4 text-blue-600" />}
                        {method === 'TRANSFER' && <Landmark className="h-4 w-4 text-indigo-600" />}
                        {method === 'CREDIT' && <Receipt className="h-4 w-4 text-amber-600" />}
                        <span className="text-[10px] font-medium uppercase">{display}</span>
                    </div>
                )
            },
        },
        {
            accessorKey: "transaction_number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="N° Transacción" />
            ),
            cell: ({ row }) => (
                <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] whitespace-nowrap overflow-hidden text-ellipsis max-w-[80px]" title={row.getValue("transaction_number")}>
                        {row.getValue("transaction_number") || '-'}
                    </span>
                </div>
            ),
        },
        {
            id: "document",
            header: "Documento",
            cell: ({ row }) => {
                const payment = row.original
                return (
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            {payment.document_info ? (
                                <button
                                    onClick={() => setViewingTransaction({ type: payment.document_info!.type, id: payment.document_info!.id })}
                                    className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                >
                                    <span className="font-semibold uppercase text-[8px] text-muted-foreground">
                                        {payment.document_info.type === 'invoice' ? (payment.document_info.label.includes('Bol') ? 'Boleta' : 'Factura') :
                                            payment.document_info.type === 'purchase_order' ? 'Orden de Compra' :
                                                payment.document_info.type === 'sale_order' ? 'Nota de Venta' : payment.document_info.type}
                                    </span>
                                    <span className="text-[10px]">
                                        {payment.document_info.type === 'purchase_order' ? `OC-${payment.document_info.number}` :
                                            payment.document_info.type === 'sale_order' ? `NV-${payment.document_info.number}` :
                                                payment.document_info.label.includes('Crédito') ? `NC-${payment.document_info.number}` :
                                                    payment.document_info.label.includes('Débito') ? `ND-${payment.document_info.number}` :
                                                        payment.document_info.label.includes('Bol') ? `BOL-${payment.document_info.number}` :
                                                            `FACT-${payment.document_info.number}`}
                                    </span>
                                </button>
                            ) : (
                                <span className="font-medium text-xs text-muted-foreground italic">{payment.reference || 'Sin Documento'}</span>
                            )}
                        </div>
                        <div className="text-[10px] text-foreground font-bold mt-0.5">{payment.partner_name}</div>
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
