"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import { EmptyState } from "@/components/shared/EmptyState"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, FileBadge, Banknote, Package, Trash2, Pencil, History, FileEdit, X, MoreVertical } from "lucide-react"
import api from "@/lib/api"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { toast } from "sonner"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { PaymentModal } from "@/features/treasury/components/PaymentModal"
import { ReceiptModal } from "@/features/purchasing/components/ReceiptModal"
import { PurchaseNoteModal } from "@/features/purchasing/components/PurchaseNoteModal"
import { DocumentCompletionModal } from "@/components/shared/DocumentCompletionModal"
import { Progress } from "@/components/ui/progress"
import { DataTable } from "@/components/ui/data-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { formatPlainDate } from "@/lib/utils"
import { TableSkeleton } from "@/components/shared"
import { PageContainer } from "@/components/shared"
import { InvoiceCard } from "@/features/billing/components/InvoiceCard"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

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
    service_obligation_data?: Record<string, unknown>
    total: string
    status: string
    status_display?: string
    pending_amount?: number
    serialized_payments?: Record<string, unknown>[]
    po_receiving_status?: string
    related_stock_moves?: Record<string, unknown>[]
    related_documents?: {
        invoices: Record<string, unknown>[]
        notes: Record<string, unknown>[]
        receipts: Record<string, unknown>[]
        payments: Record<string, unknown>[]
    }
}

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "destructive" | "outline" | "success" | "info" | "warning" }> = {
    'DRAFT': { label: 'Folio Pendiente', variant: 'warning' },
    'POSTED': { label: 'Publicado', variant: 'info' },
    'PAID': { label: 'Pagado', variant: 'success' },
    'CANCELLED': { label: 'Anulado', variant: 'destructive' },
}

interface PurchasePaymentData {
    amount: string | number
    paymentMethod: string
    transaction_number?: string
    is_pending_registration?: boolean
    treasury_account_id?: string
    dteType?: string
    documentReference?: string
    documentDate?: string
    documentAttachment?: Blob | string
}

export default function PurchaseInvoicesPage() {
    const [documents, setDocuments] = useState<PurchaseDocument[]>([])
    const [loading, setLoading] = useState(true)

    const [payingDoc, setPayingDoc] = useState<PurchaseDocument | null>(null)
    const [receivingDoc, setReceivingDoc] = useState<PurchaseDocument | null>(null)
    const [notingDoc, setNotingDoc] = useState<PurchaseDocument | null>(null)
    const [completingDoc, setCompletingDoc] = useState<PurchaseDocument | null>(null)

    // Hub Panel + URL-state (?selected)
    const { openHub, isHubOpen } = useHubPanel()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const selectedId = searchParams.get('selected')
    const [hubEverOpened, setHubEverOpened] = useState(false)

    // TransactionViewModal — URL sync (ADR-0020)
    const transactionId = searchParams.get('transaction')
    const transactionType = searchParams.get('transactionType')
    const transactionView = (searchParams.get('transactionView') ?? 'details') as 'details' | 'history' | 'all'
    const viewingTransaction = transactionId && transactionType
        ? { type: transactionType, id: transactionId, view: transactionView }
        : null

    const openTransaction = (id: number | string, type: string, view: 'details' | 'history' | 'all' = 'details') => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('transaction', String(id))
        params.set('transactionType', type)
        params.set('transactionView', view)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const closeTransaction = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('transaction')
        params.delete('transactionType')
        params.delete('transactionView')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    // Open Hub if ?selected= is present (ADR-0020)
    useEffect(() => {
        if (selectedId) openHub({ invoiceId: Number(selectedId), orderId: null, type: 'purchase' })
    }, [selectedId, openHub])

    useEffect(() => {
        if (isHubOpen && selectedId) setHubEverOpened(true)
    }, [isHubOpen, selectedId])

    useEffect(() => {
        if (hubEverOpened && !isHubOpen && selectedId) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete('selected')
            const query = params.toString()
            setHubEverOpened(false)
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [isHubOpen, hubEverOpened, selectedId, pathname, searchParams, router])

    useEffect(() => {
        fetchDocuments()
    }, [])

    const fetchDocuments = async () => {
        try {
            const res = await api.get('/billing/invoices/')
            const results = res.data.results || res.data
            // Filter only purchases (those with purchase_order OR explicitly purchase DTE types if PO missing for some reason)
            // Ideally backend filters, but frontend filter for strict "Purchase" context:
            // Includes: FACTURA_COMPRA (custom type?), or standard Invoices linked to PO, or NC/ND linked to PO.
            // Let's stick to "linked to purchase_order" or "DTE Type is specifically Purchase-related" check.
            // Include: Invoices with PO OR Invoices with Service Obligation
            const filtered = results.filter((i: PurchaseDocument) =>
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

    const handlePayment = async (data: PurchasePaymentData) => {
        if (!payingDoc) return
        try {
            const formData = new FormData()
            formData.append('amount', data.amount.toString())

            // Auto-detect direction based on document type
            let paymentType = 'OUTBOUND' // Default for paying a bill
            const isCreditNote = payingDoc.dte_type === 'NOTA_CREDITO'
            if (isCreditNote) paymentType = 'INBOUND' // Receiving money back (Devolución)

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
            if (data.documentAttachment) formData.append('document_attachment', data.documentAttachment as Blob)

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
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" />
            ),
            cell: ({ row }) => (
                <DataCell.DocumentId type={row.original.dte_type} number={row.getValue("number")} />
            ),
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => (
                <span>{formatPlainDate(row.getValue("date"))}</span>
            ),
        },
        {
            accessorKey: "dte_type",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Tipo" />
            ),
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
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Proveedor" />
            ),
        },
        {
            accessorKey: "total",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Total" />
            ),
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
                            <Badge variant={badgeStyle.variant} className="text-[8px] h-4 px-1 uppercase whitespace-nowrap">
                                {badgeStyle.label}
                            </Badge>
                        )}
                        {/* Additional Status Badges */}
                        <div className="flex flex-wrap gap-1">
                            {(doc.pending_amount ?? 0) <= 0 && doc.status !== 'DRAFT' && doc.status !== 'PAID' && (
                                <Badge variant="success" className="text-[8px] h-4 px-1 uppercase whitespace-nowrap">Pagado</Badge>
                            )}
                            {doc.po_receiving_status === 'RECEIVED' && (
                                <Badge variant="outline" className="text-[8px] h-4 px-1 uppercase border-warning text-warning font-bold whitespace-nowrap">
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
                        {/* Open Action Panel */}
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

                                {/* View Details */}
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => openTransaction(doc.id, 'invoice', 'details')}
                                    title="Ver Detalle"
                                >
                                    <Eye className="h-4 w-4" />
                                </Button>

                                {/* Finalize Folio (Draft only) */}
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

                                {/* Receive/Send Merchandise */}
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


                                {/* Credit/Debit Note (Only for primary documents with folio) */}
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

                                {/* Register Payment / Refund */}
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

                                {/* Payment History */}
                                {((doc.related_documents?.payments?.length ?? 0) > 0 || (doc.serialized_payments?.length ?? 0) > 0) && (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-success"
                                        onClick={() => openTransaction(doc.id, 'invoice', 'history')}
                                        title="Historial de Pagos"
                                    >
                                        <History className="h-4 w-4" />
                                    </Button>
                                )}

                                {doc.status === 'DRAFT' ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive"
                                        onClick={() => handleDelete(doc.id)}
                                        title="Eliminar"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                ) : doc.status !== 'CANCELLED' ? (
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => handleAnnul(doc.id)}
                                        title="Anular Documento"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                ) : null}
                            </>
                        )}
                    </div>
                )
            },
        },
    ]

    return (
        <PageContainer>
            {loading ? (
                <div className="rounded-xl border shadow-sm overflow-hidden bg-card p-4">
                    <TableSkeleton rows={5} columns={8} />
                </div>
            ) : (
                <div className="">
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
                                <EmptyState
                                    context="inventory"
                                    variant="full"
                                    title="No se encontraron documentos"
                                    className="bg-muted/30 rounded-lg border-2 border-dashed"
                                />
                            )
                        }
                        return (
                            <div className="grid gap-3 pt-2">
                                {rows.map((row: { original: PurchaseDocument }) => {
                                    const doc: PurchaseDocument = row.original
                                    return (
                                        <InvoiceCard
                                            key={doc.id}
                                            item={doc as any}
                                            type="purchase_invoice"
                                            onClick={() => {
                                                openHub({
                                                    orderId: doc.purchase_order || null,
                                                    invoiceId: doc.id,
                                                    type: 'purchase',
                                                    onActionSuccess: fetchDocuments
                                                })
                                            }}
                                        />
                                    )
                                })}
                            </div>
                        )
                    }}
                />
                </div>
            )}

            {
                viewingTransaction && (
                    <TransactionViewModal
                        open={!!viewingTransaction}
                        onOpenChange={(open: boolean) => !open && closeTransaction()}
                        type={viewingTransaction.type as any}
                        id={viewingTransaction.id}
                        view={viewingTransaction.view}
                    />
                )
            }

            {
                payingDoc && (
                    <PaymentModal
                        open={!!payingDoc}
                        onOpenChange={(open: boolean) => !open && setPayingDoc(null)}
                        onConfirm={handlePayment as any}
                        isPurchase={true}
                        total={parseFloat(payingDoc.total)}
                        pendingAmount={payingDoc.pending_amount ?? parseFloat(payingDoc.total)}
                        hideDteFields={true}
                        isRefund={payingDoc.dte_type === 'NOTA_CREDITO'}
                        existingInvoice={{
                            dte_type: payingDoc.dte_type,
                            number: payingDoc.number,
                            document_attachment: null
                        }}
                    />
                )
            }

            {
                receivingDoc && receivingDoc.purchase_order && (
                    <ReceiptModal
                        open={!!receivingDoc}
                        onOpenChange={(open: boolean) => !open && setReceivingDoc(null)}
                        orderId={receivingDoc.purchase_order}
                        onSuccess={fetchDocuments}
                        isRefund={receivingDoc.dte_type === 'NOTA_CREDITO'}
                    />
                )
            }


            {
                notingDoc && (
                    <PurchaseNoteModal
                        open={!!notingDoc}
                        onOpenChange={(open: boolean) => !open && setNotingDoc(null)}
                        orderId={notingDoc.purchase_order}
                        orderNumber={notingDoc.purchase_order_number || notingDoc.purchase_order?.toString()}
                        invoiceId={notingDoc.id}
                        onSuccess={fetchDocuments}
                    />
                )
            }

            {
                completingDoc && (
                    <DocumentCompletionModal
                        open={!!completingDoc}
                        onOpenChange={(open: boolean) => !open && setCompletingDoc(null)}
                        invoiceId={completingDoc.id}
                        invoiceType={completingDoc.dte_type}
                        onComplete={async (invoiceId, formData) => {
                            await api.post(`/billing/invoices/${invoiceId}/confirm/`, formData, {
                                headers: { 'Content-Type': 'multipart/form-data' }
                            })
                        }}
                        onSuccess={fetchDocuments}
                    />
                )
            }

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Documento"
                description="¿Está seguro de eliminar este documento? Esta acción no se puede deshacer."
                variant="destructive"
            />

            <ActionConfirmModal
                open={annulConfirm.isOpen}
                onOpenChange={(open) => { if (!open) annulConfirm.cancel() }}
                onConfirm={annulConfirm.confirm}
                title="Anular Documento"
                description="¿Está seguro de que desea ANULAR este documento? Esta acción generará reversos contables y no se puede deshacer."
                variant="destructive"
            />

            <ActionConfirmModal
                open={forceAnnulConfirm.isOpen}
                onOpenChange={(open) => { if (!open) forceAnnulConfirm.cancel() }}
                onConfirm={forceAnnulConfirm.confirm}
                title="Desvincular y Anular Pagos"
                description="Este documento tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?"
                variant="destructive"
            />
        </PageContainer>
    )
}


