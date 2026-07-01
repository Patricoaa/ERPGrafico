"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import { useState, useEffect } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { type ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { ActionConfirmModal, Chip, DocumentCompletionModal, MoneyDisplay } from '@/components/shared'
import { FileBadge, History, FileEdit, MoreVertical } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { LazyDrawer } from "@/features/_shared"
import { PaymentModal } from "@/features/treasury"
import { ReceiptModal, PurchaseNoteModal } from "@/features/purchasing"

import { Progress } from "@/components/ui/progress"
import { DataTableView, DataCell, DataTableColumnHeader, SegmentationBar } from '@/components/shared'
import { formatPlainDate } from "@/lib/utils"
import { useSmartSearch, SmartSearchBar, StatusBadge } from "@/components/shared"
import { getDtePrefix } from "@/lib/entity-registry"
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { usePurchaseInvoices, purchaseInvoiceSearchDef } from "@/features/billing"

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

export default function PurchasesPageClient() {
    const { filters, clearAll, isFiltered } = useSmartSearch(purchaseInvoiceSearchDef)

    const { invoices, isLoading: isDataLoading, isRefetching, refetch, annulInvoice, confirmInvoice, makePayment, deleteInvoice } = usePurchaseInvoices({
        filters,
    })

    const [payingDoc, setPayingDoc] = useState<PurchaseDocument | null>(null)
    const [receivingDoc, setReceivingDoc] = useState<PurchaseDocument | null>(null)
    const [notingDoc, setNotingDoc] = useState<PurchaseDocument | null>(null)
    const [completingDoc, setCompletingDoc] = useState<PurchaseDocument | null>(null)

    const { openHub, isHubOpen } = useHubPanel()
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()
    const selectedId = searchParams.get('selected')

    const [viewingTransaction, setViewingTransaction] = useState<{ type: string; id: string } | null>(null)

    const openTransaction = (id: number | string, type: string) => {
        setViewingTransaction({ type, id: String(id) })
    }

    const closeTransaction = () => {
        setViewingTransaction(null)
    }

    useEffect(() => {
        if (selectedId) openHub({ invoiceId: Number(selectedId), orderId: null, type: 'purchase' })
    }, [selectedId, openHub])

    // Detect hub close → clean URL (adjust-during-render for tracking, effect for side effect)
    const [prevHubOpen, setPrevHubOpen] = useState(isHubOpen)
    const [hubClosedWithSelection, setHubClosedWithSelection] = useState(false)

    if (prevHubOpen !== isHubOpen) {
        setPrevHubOpen(isHubOpen)
        if (!isHubOpen && selectedId) {
            setHubClosedWithSelection(true)
        }
    }

    useEffect(() => {
        if (hubClosedWithSelection && !isHubOpen && selectedId) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete('selected')
            const query = params.toString()
            router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
        }
    }, [hubClosedWithSelection, isHubOpen, selectedId, pathname, searchParams, router])

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteInvoice(id)
        } catch (error: unknown) {
            console.error("Error deleting document:", error)
            showApiError(error, "No se pudo eliminar el documento")
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const forceAnnulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await annulInvoice({ id, force: true })
        } catch (error: unknown) {
            toast.error(getErrorMessage(error) || "Error al anular el documento.")
        }
    })

    const annulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await annulInvoice({ id, force: false })
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

            let paymentType = 'OUTBOUND'
            const isCreditNote = payingDoc.dte_type === 'NOTA_CREDITO'
            if (isCreditNote) paymentType = 'INBOUND'

            formData.append('payment_type', paymentType)
            const prefix = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(payingDoc.dte_type) ? getDtePrefix(payingDoc.dte_type) : 'PAGO';
            formData.append('reference', `${prefix}-${payingDoc.number}`)
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

            await makePayment(formData)
            setPayingDoc(null)
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
                <DataCell.Entity entityLabel="billing.invoice" data={row.original} />
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
                    <div className="flex items-center gap-2">
                        <FileBadge className={`h-4 w-4 ${doc.dte_type === 'NOTA_CREDITO' ? 'text-primary' : doc.dte_type === 'NOTA_DEBITO' ? 'text-warning' : 'text-muted-foreground'}`} />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <span className="text-xs font-bold uppercase hidden md:inline-block">
                                    {getDtePrefix(doc.dte_type)}
                                </span>
                            </TooltipTrigger>
                            <TooltipContent side="top">{doc.dte_type_display}</TooltipContent>
                        </Tooltip>
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
                return (
                    <div className="flex flex-col gap-1 items-start">
                        {doc.status !== 'POSTED' && (
                            <StatusBadge
                                status={doc.status}
                                label={doc.status === 'DRAFT' ? 'Folio Pendiente' : undefined}
                                size="xs"
                            />
                        )}
                        <div className="flex flex-wrap gap-1">
                            {(doc.pending_amount ?? 0) <= 0 && doc.status !== 'DRAFT' && doc.status !== 'PAID' && (
                                <StatusBadge status="PAID" size="xs" />
                            )}
                            {doc.po_receiving_status === 'RECEIVED' && (
                                <Chip size="xs" intent="warning" className="border-warning text-warning">
                                    {doc.dte_type === 'NOTA_CREDITO' ? 'Devuelto' : 'Recibido'}
                                </Chip>
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
                                    orderId: doc.purchase_order,
                                    invoiceId: ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(doc.dte_type) ? doc.id : null,
                                    type: 'purchase',
                                    onActionSuccess: refetch
                                })}
                                title="Gestionar Orden"
                                className="h-8 px-3"
                            >
                                <MoreVertical className="h-4 w-4 mr-1" />
                                Gestionar
                            </Button>
                        ) : (
                            (() => {
                                const canPay = (doc.pending_amount ?? 0) > 0 && ['POSTED'].includes(doc.status)
                                const canReceive = (doc.purchase_order || isNote) && doc.po_receiving_status !== 'RECEIVED'
                                const canCompleteFolio = doc.status === 'DRAFT'
                                const canCreateNote = !isNote && doc.number && doc.status !== 'DRAFT'
                                const hasPayments = (doc.related_documents?.payments?.length ?? 0) > 0 || (doc.serialized_payments?.length ?? 0) > 0
                                const canDelete = doc.status === 'DRAFT'
                                const canAnnul = doc.status !== 'DRAFT' && doc.status !== 'CANCELLED'

                                const overflow = [
                                    ...(canCompleteFolio ? [{ icon: FileEdit, label: 'Completar Folio', onClick: () => setCompletingDoc(doc) }] : []),
                                    ...(canReceive ? [{ action: 'receive' as const, label: doc.dte_type === 'NOTA_CREDITO' ? 'Devolución Mercadería' : 'Recibir Mercadería', onClick: () => setReceivingDoc(doc) }] : []),
                                    ...(canCreateNote ? [{ icon: FileBadge, label: 'Registrar Nota Crédito/Débito', onClick: () => setNotingDoc(doc) }] : []),
                                    ...(hasPayments ? [{ icon: History, label: 'Historial de Pagos', onClick: () => openTransaction(doc.id, 'invoice') }] : []),
                                    ...((canAnnul || canDelete) ? [{ separator: true } as const] : []),
                                    ...(canDelete ? [{ action: 'delete' as const, onClick: () => handleDelete(doc.id) }] : []),
                                    ...(canAnnul ? [{ action: 'annul' as const, onClick: () => handleAnnul(doc.id) }] : []),
                                ]

                                return (
                                    <>
                                        <DataCell.Action action="detail" title="Ver Detalle" onClick={() => openTransaction(doc.id, 'invoice')} />
                                        {canPay && (
                                            <DataCell.Action
                                                action="pay"
                                                title={doc.dte_type === 'NOTA_CREDITO' ? 'Registrar Devolución Dinero' : 'Registrar Pago'}
                                                onClick={() => setPayingDoc(doc)}
                                            />
                                        )}
                                        {overflow.length > 0 && <DataCell.ActionMenu items={overflow} />}
                                    </>
                                )
                            })()
                        )}
                    </div>
                )
            },
        },
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={invoices as PurchaseDocument[]}
                    variant="embedded"
                    isLoading={isDataLoading}
                    isRefetching={isRefetching}
                    entityLabel="billing.invoice"
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "purchase",
                        title: "Aún no hay documentos de compra",
                        description: "Las facturas y boletas de proveedores que registres aparecerán aquí.",
                    }}
                    smartSearch={
                        <SmartSearchBar
                            searchDef={purchaseInvoiceSearchDef}
                            placeholder="Buscar por proveedor, folio o fecha..."
                        />
                    }
                    onReset={clearAll}
                    isHubOpen={isHubOpen}
                    isSelected={(doc: PurchaseDocument) => selectedId === String(doc.id)}
                    onRowClick={(doc: PurchaseDocument) => {
                        openHub({
                            orderId: doc.purchase_order || null,
                            invoiceId: doc.id,
                            type: 'purchase',
                            onActionSuccess: refetch,
                        })
                    }}
                    segmentation={
                        <SegmentationBar def={{
                            segments: [
                                { key: 'status', label: 'Estado', type: 'multiselect', serverParam: 'status', columnId: 'status', dynamic: true, options: [] },
                            ],
                        }} />
                    }
                    defaultPageSize={20}
                    cardGroupBy={{ field: 'date', sort: 'desc', aggregators: [{ key: 'total', label: 'Total', field: 'total', fn: 'sum', format: 'money' }, { key: 'count', label: 'Items', fn: 'count', format: 'integer' }] }}
                />
            </div>

            {
                viewingTransaction && (
                    <LazyDrawer
                        type={viewingTransaction.type}
                        id={Number(viewingTransaction.id)}
                        open={!!viewingTransaction}
                        onOpenChange={(open: boolean) => !open && closeTransaction()}
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
                        onSuccess={refetch}
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
                        onSuccess={refetch}
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
                            await confirmInvoice({ id: invoiceId, payload: formData })
                        }}
                        onSuccess={refetch}
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
        </div>
    )
}
