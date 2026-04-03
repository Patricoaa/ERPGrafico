"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import { useState, useEffect } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, FileBadge, Banknote, Package, Trash2, Pencil, History, FileEdit, X, MoreVertical } from "lucide-react"
import api from "@/lib/api"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { toast } from "sonner"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { PaymentDialog } from "@/features/treasury/components/PaymentDialog"
import { ReceiptModal } from "@/features/purchasing/components/ReceiptModal"
import { PurchaseNoteModal } from "@/features/purchasing/components/PurchaseNoteModal"
import { DocumentCompletionModal } from "@/components/shared/DocumentCompletionModal"
import { Progress } from "@/components/ui/progress"
import { DataTable } from "@/components/ui/data-table"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { DataCell } from "@/components/ui/data-table-cells"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { formatPlainDate } from "@/lib/utils"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { InvoiceCard } from "@/features/billing/components/InvoiceCard"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { EmptyState } from "@/components/shared/EmptyState"

interface PurchaseDocument {
    id: number
    date: string
    dte_type: string
    dte_type_display?: string
    number: string
    partner_name?: string
    purchase_order?: number
    purchase_order_number?: string
    service_obligation?: number
    service_obligation_data?: any
    total: string
    status: string
    status_display?: string
    pending_amount?: number
    serialized_payments?: any[]
    po_receiving_status?: string
    related_stock_moves?: any[]
    related_documents?: {
        invoices: any[]
        notes: any[]
        receipts: any[]
        payments: any[]
    }
}

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "destructive" | "outline" | "success" | "info" | "warning" }> = {
    'DRAFT': { label: 'Folio Pendiente', variant: 'warning' as any },
    'POSTED': { label: 'Publicado', variant: 'info' },
    'PAID': { label: 'Pagado', variant: 'success' },
    'CANCELLED': { label: 'Anulado', variant: 'destructive' },
}

export function PurchaseInvoicesClientView() {
    const [documents, setDocuments] = useState<PurchaseDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)

    const [payingDoc, setPayingDoc] = useState<PurchaseDocument | null>(null)
    const [receivingDoc, setReceivingDoc] = useState<PurchaseDocument | null>(null)
    const [notingDoc, setNotingDoc] = useState<PurchaseDocument | null>(null)
    const [completingDoc, setCompletingDoc] = useState<PurchaseDocument | null>(null)

    const { openHub } = useHubPanel()

    useEffect(() => {
        fetchDocuments()
    }, [])

    const fetchDocuments = async () => {
        try {
            const res = await api.get('/billing/invoices/')
            const results = res.data.results || res.data
            const filtered = results.filter((i: any) =>
                i.purchase_order ||
                i.service_obligation ||
                i.dte_type === 'PURCHASE_INV'
            )
            setDocuments(filtered)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar documentos")
        } finally {
            setLoading(false)
        }
    }

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/billing/invoices/${id}/`)
            toast.success("Documento eliminado correctamente")
            fetchDocuments()
        } catch (error: unknown) {
            console.error("Error deleting document:", error)
            showApiError(error, "No se pudo eliminar el documento")
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const forceAnnulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.post(`/billing/invoices/${id}/annul/`, { force: true })
            toast.success("Documento anulado correctamente.")
            fetchDocuments()
        } catch (error: unknown) {
            toast.error(getErrorMessage(error) || "Error al anular el documento.")
        }
    })

    const annulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.post(`/billing/invoices/${id}/annul/`, { force: false })
            toast.success("Documento anulado correctamente.")
            fetchDocuments()
        } catch (error: unknown) {
            console.error("Error annulling invoice:", error)
            const errorMessage = getErrorMessage(error) || ""

            if (errorMessage.includes("Debe anular los pagos asociados")) {
                forceAnnulConfirm.requestConfirm(id)
                return
            }

            toast.error(errorMessage || "Error al anular el documento.")
        }
    })

    const handleAnnul = (id: number) => annulConfirm.requestConfirm(id)

    const handlePayment = async (data: any) => {
        if (!payingDoc) return
        try {
            const formData = new FormData()
            formData.append('amount', data.amount.toString())

            let paymentType = 'OUTBOUND'
            const isCreditNote = payingDoc.dte_type === 'NOTA_CREDITO'
            if (isCreditNote) paymentType = 'INBOUND'

            formData.append('payment_type', paymentType)
            formData.append('reference', `${payingDoc.dte_type === 'NOTA_CREDITO' ? 'NC' : payingDoc.dte_type === 'NOTA_DEBITO' ? 'ND' : 'PAGO'}-${payingDoc.number}`)
            formData.append('purchase_order', payingDoc.purchase_order ? payingDoc.purchase_order.toString() : '')
            formData.append('invoice', payingDoc.id.toString())
            formData.append('payment_method', data.paymentMethod)

            if (data.transaction_number) formData.append('transaction_number', data.transaction_number)
            if (data.is_pending_registration !== undefined) formData.append('is_pending_registration', data.is_pending_registration.toString())
            if (data.treasury_account_id) formData.append('treasury_account_id', data.treasury_account_id)
            if (data.dteType) formData.append('dte_type', data.dteType)
            if (data.documentReference) formData.append('document_reference', data.documentReference)
            if (data.documentDate) formData.append('document_date', data.documentDate)
            if (data.documentAttachment) formData.append('document_attachment', data.documentAttachment)

            await api.post('/treasury/payments/', formData)
            toast.success("Operación registrada correctamente")
            setPayingDoc(null)
            fetchDocuments()
        } catch (error: unknown) {
            console.error("Error registering payment:", error)
            showApiError(error, "Error al registrar la operación")
        }
    }

    const columns: ColumnDef<PurchaseDocument>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" />,
            cell: ({ row }) => <DataCell.DocumentId type={row.original.dte_type} number={row.getValue("number")} />,
        },
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" />,
            cell: ({ row }) => <span>{formatPlainDate(row.getValue("date"))}</span>,
        },
        {
            accessorKey: "dte_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" />,
            cell: ({ row }) => {
                const doc = row.original
                return (
                    <div className="flex items-center gap-2" title={doc.dte_type_display}>
                        <FileBadge className={`h-4 w-4 ${doc.dte_type === 'NOTA_CREDITO' ? 'text-primary' : doc.dte_type === 'NOTA_DEBITO' ? 'text-warning' : 'text-muted-foreground'}`} />
                        <span className="text-xs font-bold uppercase hidden md:inline-block">
                            {doc.dte_type === 'NOTA_CREDITO' ? 'NC' :
                                doc.dte_type === 'NOTA_DEBITO' ? 'ND' :
                                    doc.dte_type === 'BOLETA' ? 'BOL' :
                                        doc.dte_type === 'FACTURA_EXENTA' ? 'FE' :
                                            doc.dte_type === 'BOLETA_EXENTA' ? 'BE' : 'FAC'}
                        </span>
                    </div>
                )
            },
        },
        {
            accessorKey: "partner_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Proveedor" />,
        },
        {
            accessorKey: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" />,
            cell: ({ row }) => (
                <div className="text-right">
                    <MoneyDisplay amount={Number(row.getValue("total"))} showColor={false} />
                </div>
            ),
        },
        {
            id: "payment_status",
            header: "Pagado/Devuelto",
            cell: ({ row }) => {
                const doc = row.original
                const total = parseFloat(doc.total)
                const pending = doc.pending_amount ?? total
                const paid = total - pending
                const percentage = total > 0 ? Math.round((paid / total) * 100) : 0
                return (
                    <div className="space-y-1 w-32">
                        <div className="flex justify-between text-[10px] font-bold">
                            <span>{percentage}%</span>
                            <MoneyDisplay amount={paid} showColor={false} className="text-[10px]" />
                        </div>
                        <Progress value={percentage} className="h-1" />
                    </div>
                )
            },
        },
        {
            accessorKey: "status",
            header: "Estado",
            cell: ({ row }) => {
                const doc = row.original
                const badgeStyle = statusMap[doc.status] || { label: doc.status, variant: 'secondary' }
                return (
                    <div className="flex flex-col gap-1">
                        {doc.status !== 'POSTED' && (
                            <Badge variant={badgeStyle.variant as any} className="text-[8px] h-4 px-1 uppercase whitespace-nowrap">
                                {badgeStyle.label}
                            </Badge>
                        )}
                        <div className="flex flex-wrap gap-1">
                            {(doc.pending_amount ?? 0) <= 0 && doc.status !== 'DRAFT' && doc.status !== 'PAID' && (
                                <Badge variant="success" className="text-[8px] h-4 px-1 uppercase whitespace-nowrap">Pagado</Badge>
                            )}
                            {doc.po_receiving_status === 'RECEIVED' && (
                                <Badge variant="outline" className="text-[8px] h-4 px-1 uppercase border-warning/50 text-warning font-bold whitespace-nowrap">
                                    {doc.dte_type === 'NOTA_CREDITO' ? 'Devuelto' : 'Recibido'}
                                </Badge>
                            )}
                        </div>
                    </div>
                )
            },
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => {
                const doc = row.original
                const isNote = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(doc.dte_type)

                return (
                    <div className="flex justify-center space-x-1">
                        {doc.purchase_order ? (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => openHub({
                                    orderId: doc.purchase_order!,
                                    invoiceId: ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(doc.dte_type) ? doc.id : null,
                                    type: 'purchase',
                                    onActionSuccess: fetchDocuments
                                })}
                                title="Gestionar Orden"
                                className="h-8 px-3"
                            >
                                <MoreVertical className="h-4 w-4 mr-1" />
                                Gestionar
                            </Button>
                        ) : (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setViewingTransaction({ type: 'invoice', id: doc.id, view: 'details' })}
                                    title="Ver Detalle"
                                >
                                    <Eye className="h-4 w-4" />
                                </Button>
                                {doc.status === 'DRAFT' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-warning"
                                        onClick={() => setCompletingDoc(doc)}
                                        title="Completar Folio"
                                    >
                                        <FileEdit className="h-4 w-4" />
                                    </Button>
                                )}
                                {(doc.purchase_order || isNote) && doc.po_receiving_status !== 'RECEIVED' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-warning"
                                        onClick={() => setReceivingDoc(doc)}
                                        title={doc.dte_type === 'NOTA_CREDITO' ? "Devolución Mercadería" : "Recibir Mercadería"}
                                    >
                                        <Package className="h-4 w-4" />
                                    </Button>
                                )}
                                {!isNote && doc.number && doc.status !== 'DRAFT' && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-warning"
                                        onClick={() => setNotingDoc(doc)}
                                        title="Registrar Nota Crédito/Débito"
                                    >
                                        <FileBadge className="h-4 w-4" />
                                    </Button>
                                )}
                                {(doc.pending_amount ?? 0) > 0 && ['POSTED'].includes(doc.status) && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-success"
                                        onClick={() => setPayingDoc(doc)}
                                        title={doc.dte_type === 'NOTA_CREDITO' ? "Registrar Devolución Dinero" : "Registrar Pago"}
                                    >
                                        <Banknote className="h-4 w-4" />
                                    </Button>
                                )}
                                {((doc.related_documents?.payments?.length ?? 0) > 0 || (doc.serialized_payments?.length ?? 0) > 0) && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-success"
                                        onClick={() => setViewingTransaction({ type: 'invoice', id: doc.id, view: 'history' })}
                                        title="Historial de Pagos"
                                    >
                                        <History className="h-4 w-4" />
                                    </Button>
                                )}
                                {doc.status === 'DRAFT' ? (
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => handleDelete(doc.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                                ) : doc.status !== 'CANCELLED' ? (
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleAnnul(doc.id)} title="Anular Documento"><X className="h-4 w-4" /></Button>
                                ) : null}
                            </>
                        )}
                    </div>
                )
            },
        },
    ]

    return (
        <div className="space-y-4 px-1">
            {loading ? (
                <div className="rounded-xl border shadow-sm overflow-hidden bg-card p-10 text-center">Cargando documentos...</div>
            ) : (
                <DataTable
                    columns={columns}
                    data={documents}
                    cardMode
                    isLoading={loading}
                    filterColumn="partner_name"
                    searchPlaceholder="Buscar por proveedor..."
                    facetedFilters={[
                        {
                            column: "status",
                            title: "Estado",
                            options: [
                                { label: "Folio Pendiente", value: "DRAFT" },
                                { label: "Publicado", value: "POSTED" },
                                { label: "Pagado", value: "PAID" },
                                { label: "Anulado", value: "CANCELLED" },
                            ],
                        },
                    ]}
                    useAdvancedFilter={true}
                    defaultPageSize={20}
                    renderCustomView={(table) => {
                        const rows = table.getRowModel().rows
                        if (rows.length === 0) {
                            return (
                                <div className="py-12">
                                    <EmptyState context="search" title="No hay documentos" description="No se encontraron facturas recibidas." />
                                </div>
                            )
                        }
                        return (
                            <div className="grid gap-3 pt-2">
                                {rows.map((row: any) => (
                                    <InvoiceCard
                                        key={row.original.id}
                                        item={row.original}
                                        type="purchase_invoice"
                                        onClick={() => openHub({ orderId: row.original.purchase_order || null, invoiceId: row.original.id, type: 'purchase', onActionSuccess: fetchDocuments })}
                                    />
                                ))}
                            </div>
                        )
                    }}
                />
            )}
            {viewingTransaction && <TransactionViewModal open={!!viewingTransaction} onOpenChange={(open) => !open && setViewingTransaction(null)} type={viewingTransaction.type} id={viewingTransaction.id} view={viewingTransaction.view} />}
            {payingDoc && <PaymentDialog open={!!payingDoc} onOpenChange={(open) => !open && setPayingDoc(null)} onConfirm={handlePayment} isPurchase={true} total={parseFloat(payingDoc.total)} pendingAmount={payingDoc.pending_amount ?? parseFloat(payingDoc.total)} hideDteFields={true} isRefund={payingDoc.dte_type === 'NOTA_CREDITO'} existingInvoice={{ dte_type: payingDoc.dte_type, number: payingDoc.number, document_attachment: null }} />}
            {receivingDoc && receivingDoc.purchase_order && <ReceiptModal open={!!receivingDoc} onOpenChange={(open) => !open && setReceivingDoc(null)} orderId={receivingDoc.purchase_order} onSuccess={fetchDocuments} isRefund={receivingDoc.dte_type === 'NOTA_CREDITO'} />}
            {notingDoc && <PurchaseNoteModal open={!!notingDoc} onOpenChange={(open) => !open && setNotingDoc(null)} orderId={notingDoc.purchase_order} orderNumber={notingDoc.purchase_order_number || notingDoc.purchase_order?.toString()} invoiceId={notingDoc.id} onSuccess={fetchDocuments} />}
            {completingDoc && <DocumentCompletionModal open={!!completingDoc} onOpenChange={(open) => !open && setCompletingDoc(null)} invoiceId={completingDoc.id} invoiceType={completingDoc.dte_type} onComplete={async (invoiceId, formData) => { await api.post(`/billing/invoices/${invoiceId}/confirm/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }) }} onSuccess={fetchDocuments} />}
            <ActionConfirmModal open={deleteConfirm.isOpen} onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }} onConfirm={deleteConfirm.confirm} title="Eliminar Documento" description="¿Está seguro de eliminar este documento? Esta acción no se puede deshacer." variant="destructive" />
            <ActionConfirmModal open={annulConfirm.isOpen} onOpenChange={(open) => { if (!open) annulConfirm.cancel() }} onConfirm={annulConfirm.confirm} title="Anular Documento" description="¿Está seguro de que desea ANULAR este documento?" variant="destructive" />
            <ActionConfirmModal open={forceAnnulConfirm.isOpen} onOpenChange={(open) => { if (!open) forceAnnulConfirm.cancel() }} onConfirm={forceAnnulConfirm.confirm} title="Desvincular y Anular Pagos" description="Este documento tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?" variant="destructive" />
        </div>
    )
}
