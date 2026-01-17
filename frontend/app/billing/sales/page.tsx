"use client"

import { useState, useEffect } from "react"

import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"

import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Eye, Banknote, History, X, FileBadge, Receipt, FileUp, MoreVertical } from "lucide-react"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { toast } from "sonner"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { SaleNoteModal } from "@/components/sales/SaleNoteModal"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"

export default function SalesInvoicesPage() {
    const [invoices, setInvoices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)
    const [notingInvoice, setNotingInvoice] = useState<any | null>(null)
    const [payingInv, setPayingInv] = useState<any | null>(null)

    // Action Panel state
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

    useEffect(() => {
        fetchInvoices()
    }, [])

    const fetchInvoices = async () => {
        try {
            const res = await api.get('/billing/invoices/')
            // Filter only sales
            const results = res.data.results || res.data
            setInvoices(results.filter((i: any) => i.sale_order))
        } catch (error) {
            toast.error("Error al cargar facturas")
        } finally {
            setLoading(false)
        }
    }

    const handleAnnul = async (id: number, force: boolean = false) => {
        if (!force && !confirm("¿Está seguro de que desea ANULAR este documento? Esta acción generará reversos contables y no se puede deshacer.")) return
        try {
            await api.post(`/billing/invoices/${id}/annul/`, { force })
            toast.success("Documento anulado correctamente.")
            fetchInvoices()
        } catch (error: any) {
            console.error("Error annulling invoice:", error)
            const errorMessage = error.response?.data?.error || ""

            if (errorMessage.includes("Debe anular los pagos asociados") && !force) {
                if (confirm("Este documento tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?")) {
                    handleAnnul(id, true)
                    return
                }
            }

            toast.error(errorMessage || "Error al anular el documento.")
        }
    }

    const handlePayment = async (data: any) => {
        if (!payingInv) return
        try {
            const formData = new FormData()
            formData.append('amount', data.amount.toString())

            // Auto-detect direction based on document type
            let paymentType = 'INBOUND' // Default for receiving payment from a sale
            const isCreditNote = payingInv.dte_type === 'NOTA_CREDITO'
            if (isCreditNote) paymentType = 'OUTBOUND' // Refunding money back (Devolución)

            formData.append('payment_type', paymentType)
            formData.append('reference', `${payingInv.dte_type === 'NOTA_CREDITO' ? 'NC' : payingInv.dte_type === 'NOTA_DEBITO' ? 'ND' : 'PAGO'}-${payingInv.number}`)
            formData.append('sale_order', payingInv.sale_order ? payingInv.sale_order.toString() : '')
            formData.append('invoice', payingInv.id.toString())
            formData.append('payment_method', data.paymentMethod)

            if (data.transaction_number) formData.append('transaction_number', data.transaction_number)
            if (data.is_pending_registration !== undefined) formData.append('is_pending_registration', data.is_pending_registration.toString())
            if (data.treasury_account_id) formData.append('treasury_account_id', data.treasury_account_id)
            if (data.dteType) formData.append('dte_type', data.dteType)
            if (data.documentReference) formData.append('document_reference', data.documentReference)
            if (data.documentDate) formData.append('document_date', data.documentDate)
            if (data.documentAttachment) formData.append('document_attachment', data.documentAttachment)

            await api.post('/treasury/payments/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            toast.success("Operación registrada correctamente")
            setPayingInv(null)
            fetchInvoices()
        } catch (error: any) {
            console.error("Error registering payment:", error)
            toast.error(error.response?.data?.error || "Error al registrar la operación")
        }
    }

    const columns: ColumnDef<any>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => (
                <span className="font-mono font-medium">{row.getValue("number") || '---'}</span>
            ),
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
        },
        {
            accessorKey: "dte_type_display",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
        },
        {
            accessorKey: "partner_name",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Cliente" />
            ),
        },
        {
            accessorKey: "origin",
            header: "Origen",
            cell: ({ row }) => {
                const inv = row.original
                return (
                    <div className="flex flex-col gap-1">
                        <button
                            onClick={() => setViewingTransaction({ type: 'sale_order', id: inv.sale_order })}
                            className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                        >
                            <span className="font-semibold uppercase text-[8px] text-muted-foreground">Nota de Venta</span>
                            NV-{inv.sale_order_number}
                        </button>
                    </div>
                )
            },
        },
        {
            accessorKey: "total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" />
            ),
            cell: ({ row }) => (
                <div className="text-right font-medium">
                    ${Number(row.getValue("total")).toLocaleString()}
                </div>
            ),
        },
        {
            accessorKey: "status",
            header: "Estado",
            cell: ({ row }) => {
                const inv = row.original
                return (
                    <Badge variant={inv.status === 'PAID' ? 'success' : inv.status === 'POSTED' ? 'info' : inv.status === 'CANCELLED' ? 'destructive' : 'secondary'}>
                        {inv.status === 'CANCELLED' ? 'Anulado' : inv.status_display}
                    </Badge>
                )
            },
        },
        {
            id: "actions",
            cell: ({ row }) => {
                const inv = row.original
                return (
                    <div className="flex space-x-1">
                        {/* Open Action Panel */}
                        {inv.sale_order ? (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => setSelectedOrderId(inv.sale_order)}
                                title="Gestionar Orden"
                                className="h-8 px-3 w-full"
                            >
                                <MoreVertical className="h-4 w-4 mr-1" />
                                Gestionar
                            </Button>
                        ) : (
                            <>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setViewingTransaction({ type: 'invoice', id: inv.id, view: 'details' })}
                                    title="Ver Detalle"
                                >
                                    <Eye className="h-4 w-4" />
                                </Button>

                                {/* Historial de Pagos */}
                                {((inv.related_documents?.payments?.length ?? 0) > 0 || inv.status === 'PAID') && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-emerald-600"
                                        onClick={() => setViewingTransaction({ type: 'invoice', id: inv.id, view: 'history' })}
                                        title="Historial de Pagos"
                                    >
                                        <History className="h-4 w-4" />
                                    </Button>
                                )}

                                {inv.status !== 'CANCELLED' && (
                                    <>
                                        {/* Registrar Pago / Reembolso */}
                                        {(inv.pending_amount ?? (inv.status === 'PAID' ? 0 : inv.total)) > 0 && inv.status === 'POSTED' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-emerald-600"
                                                onClick={() => setPayingInv(inv)}
                                                title={inv.dte_type === 'NOTA_CREDITO' ? "Registrar Reembolso" : "Registrar Pago"}
                                            >
                                                <Banknote className="h-4 w-4" />
                                            </Button>
                                        )}

                                        {/* Registrar Nota (Solo para Facturas/Boletas, no sobre Notas) */}
                                        {!['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type) && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-purple-600"
                                                onClick={() => setNotingInvoice(inv)}
                                                title="Registrar Nota Crédito/Débito"
                                            >
                                                <FileBadge className="h-4 w-4" />
                                            </Button>
                                        )}

                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive hover:text-destructive"
                                            onClick={() => handleAnnul(inv.id)}
                                            title="Anular Documento"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                )
            },
        },
    ]

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Documentos Emitidos</h1>
            </div>

            {loading ? (
                <div className="rounded-xl border shadow-sm overflow-hidden bg-card p-10 text-center">
                    Cargando facturas...
                </div>
            ) : (
                <DataTable columns={columns} data={invoices} defaultPageSize={20} />
            )}

            {viewingTransaction && (
                <TransactionViewModal
                    open={!!viewingTransaction}
                    onOpenChange={(open) => !open && setViewingTransaction(null)}
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                    view={viewingTransaction.view}
                />
            )}

            {notingInvoice && (
                <SaleNoteModal
                    open={!!notingInvoice}
                    onOpenChange={(open) => !open && setNotingInvoice(null)}
                    orderId={notingInvoice.sale_order}
                    orderNumber={notingInvoice.sale_order_number}
                    invoiceId={notingInvoice.id}
                    onSuccess={fetchInvoices}
                />
            )}

            {payingInv && (
                <PaymentDialog
                    open={!!payingInv}
                    onOpenChange={(open) => !open && setPayingInv(null)}
                    onConfirm={handlePayment}
                    isPurchase={false}
                    total={parseFloat(payingInv.total)}
                    pendingAmount={payingInv.pending_amount ?? parseFloat(payingInv.total)}
                    hideDteFields={true}
                    isRefund={payingInv.dte_type === 'NOTA_CREDITO'}
                    existingInvoice={{
                        dte_type: payingInv.dte_type,
                        number: payingInv.number,
                        document_attachment: null
                    }}
                />
            )}

            <OrderCommandCenter
                orderId={selectedOrderId}
                type="sale"
                open={selectedOrderId !== null}
                onOpenChange={(open) => !open && setSelectedOrderId(null)}
                onActionSuccess={fetchInvoices}
            />
        </div>
    )
}
