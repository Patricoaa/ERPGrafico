"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import { useState } from "react"
import { ColumnDef } from "@tanstack/react-table"
import { IconButton } from "@/components/shared"
import { List, FileBadge, LayoutDashboard, ArrowRight, ArrowLeft } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { PaymentModal } from "@/features/treasury/components/PaymentModal"
import { ReceiptModal } from "@/features/purchasing/components/ReceiptModal"
import { PurchaseNoteModal } from "@/features/purchasing/components/PurchaseNoteModal"
import { DocumentCompletionModal } from "@/components/shared/DocumentCompletionModal"
import { DataTable } from "@/components/ui/data-table"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { DataCell } from "@/components/ui/data-table-cells"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { InvoiceCard } from "@/features/billing/components/InvoiceCard"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"
import { EmptyState } from "@/components/shared/EmptyState"
import { usePurchaseInvoices } from "@/features/billing/hooks/usePurchaseInvoices"
import { Invoice } from "@/features/billing/types"

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "destructive" | "outline" | "success" | "info" | "warning" }> = {
    'DRAFT': { label: 'Folio Pendiente', variant: 'warning' as const },
    'POSTED': { label: 'Publicado', variant: 'info' },
    'PAID': { label: 'Pagado', variant: 'success' },
    'CANCELLED': { label: 'Anulado', variant: 'destructive' },
}

export function PurchaseInvoicesClientView() {
    const { invoices: documents, refetch: fetchDocuments } = usePurchaseInvoices()
    const [payingDoc, setPayingDoc] = useState<any | null>(null)
    const [receivingDoc, setReceivingDoc] = useState<any | null>(null)
    const [notingDoc, setNotingDoc] = useState<any | null>(null)
    const [completingDoc, setCompletingDoc] = useState<any | null>(null)
    const [currentView, setCurrentView] = useState<'card' | 'list'>('card')

    const viewOptions = [
        { label: "Lista", value: "list", icon: List },
        { label: "Tarjeta", value: "card", icon: LayoutDashboard }
    ]

    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()

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

    const handlePayment = async (data: Record<string, unknown>) => {
        if (!payingDoc) return
        const d = data as any
        try {
            const formData = new FormData()
            formData.append('amount', d.amount.toString())

            let paymentType = 'OUTBOUND'
            const isCreditNote = payingDoc.dte_type === 'NOTA_CREDITO'
            if (isCreditNote) paymentType = 'INBOUND'

            formData.append('payment_type', paymentType)
            formData.append('reference', `${payingDoc.dte_type === 'NOTA_CREDITO' ? 'NC' : payingDoc.dte_type === 'NOTA_DEBITO' ? 'ND' : 'PAGO'}-${payingDoc.number}`)
            formData.append('purchase_order', payingDoc.purchase_order ? payingDoc.purchase_order.toString() : '')
            formData.append('invoice', payingDoc.id.toString())
            formData.append('payment_method', d.paymentMethod)

            if (d.transaction_number) formData.append('transaction_number', d.transaction_number)
            if (d.is_pending_registration !== undefined) formData.append('is_pending_registration', d.is_pending_registration.toString())
            if (d.treasury_account_id) formData.append('treasury_account_id', d.treasury_account_id)
            if (d.dteType) formData.append('dte_type', d.dteType)
            if (d.document_reference) formData.append('document_reference', d.document_reference)
            if (d.document_date) formData.append('document_date', d.document_date)
            if (d.document_attachment) formData.append('document_attachment', d.document_attachment)

            await api.post('/treasury/payments/', formData)
            toast.success("Operación registrada correctamente")
            setPayingDoc(null)
            fetchDocuments()
        } catch (error: unknown) {
            console.error("Error registering payment:", error)
            showApiError(error, "Error al registrar la operación")
        }
    }

    const columns: ColumnDef<Invoice>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
            cell: ({ row }) => <DataCell.DocumentId label="billing.invoice" data={row.original} />,
        },
        {
            accessorKey: "date",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />,
            cell: ({ row }) => <DataCell.Date value={row.getValue("date")} />,
        },
        {
            accessorKey: "dte_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const doc = row.original
                const label = doc.dte_type === 'NOTA_CREDITO' ? 'NC' :
                    doc.dte_type === 'NOTA_DEBITO' ? 'ND' :
                        doc.dte_type === 'BOLETA' ? 'BOL' :
                            doc.dte_type === 'FACTURA_EXENTA' ? 'FE' :
                                doc.dte_type === 'BOLETA_EXENTA' ? 'BE' : 'FAC'
                return (
                    <div className="flex items-center gap-2 justify-center w-full" title={doc.dte_type_display || doc.dte_type}>
                        <FileBadge className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <DataCell.Secondary className="font-bold uppercase text-[10px]">
                            {label}
                        </DataCell.Secondary>
                    </div>
                )
            },
        },
        {
            accessorKey: "partner_name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Proveedor" className="justify-center" />,
            cell: ({ row }) => <DataCell.ContactLink contactId={row.original.partner || row.original.supplier}>{row.getValue("partner_name")}</DataCell.ContactLink>,
        },
        {
            accessorKey: "total",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Total" className="justify-center" />,
            cell: ({ row }) => <DataCell.Currency value={row.getValue("total")} />,
        },
        {
            id: "payment_status",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Pagado/Devuelto" className="justify-center" />,
            cell: ({ row }) => {
                const doc = row.original
                const total = parseFloat(doc.total)
                const pending = doc.pending_amount ?? total
                const paid = total - pending
                const percentage = total > 0 ? Math.round((paid / total) * 100) : 0
                return (
                    <div className="flex justify-center w-full">
                        <DataCell.Progress
                            value={percentage}
                            label={`${percentage}%`}
                            subLabel={paid.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })}
                            className="w-32"
                        />
                    </div>
                )
            },
        },
        {
            accessorKey: "status",
            header: () => null,
            cell: () => null,
            filterFn: (row, id, value) => value.includes(row.getValue(id)),
        },
        {
            id: "hub_trigger",
            header: () => null,
            cell: ({ row }) => {
                const item = row.original
                const isSelected = hubConfig?.invoiceId === item.id
                return (
                    <div className="flex justify-end pr-2">
                        <IconButton
                            circular
                            className="h-8 w-8 hover:bg-transparent"
                            onClick={() => {
                                if (isSelected && isHubOpen) {
                                    closeHub()
                                } else {
                                    openHub({
                                        orderId: item.purchase_order || null,
                                        invoiceId: ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(item.dte_type) ? item.id : null,
                                        type: 'purchase',
                                        onActionSuccess: fetchDocuments
                                    })
                                }
                            }}
                        >
                            {isSelected && isHubOpen ? (
                                <ArrowLeft className="h-4 w-4 text-primary animate-in fade-in slide-in-from-right-1 duration-300" />
                            ) : (
                                <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                            )}
                        </IconButton>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="space-y-4 px-1">
            <DataTable
                columns={columns}
                data={documents}
                onRowClick={(row: Invoice) => {
                    const isSelected = hubConfig?.invoiceId === row.id
                    if (isSelected && isHubOpen) {
                        closeHub()
                    } else {
                        openHub({
                            orderId: row.purchase_order || null,
                            invoiceId: ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(row.dte_type) ? row.id : null,
                            type: 'purchase',
                            onActionSuccess: fetchDocuments
                        })
                    }
                }}
                cardMode={true}
                currentView={currentView}
                onViewChange={(v: any) => setCurrentView(v as 'card' | 'list')}
                viewOptions={viewOptions}
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
                renderCustomView={currentView === 'card' ? (table) => {
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
                            {rows.map((row: any) => {
                                const inv = row.original
                                const isSelected = hubConfig?.invoiceId === inv.id

                                return (
                                    <InvoiceCard
                                        key={inv.id}
                                        item={inv}
                                        type="purchase_invoice"
                                        isSelected={isSelected}
                                        visibleColumns={table.getState().columnVisibility}
                                        onClick={() => {
                                            if (isSelected) {
                                                closeHub()
                                            } else {
                                                openHub({ orderId: inv.purchase_order || null, invoiceId: inv.id, type: 'purchase', onActionSuccess: fetchDocuments })
                                            }
                                        }}
                                    />
                                )
                            })}
                        </div>
                    )
                } : undefined}
            />
            {payingDoc && <PaymentModal open={!!payingDoc} onOpenChange={(open) => !open && setPayingDoc(null)} onConfirm={handlePayment} isPurchase={true} total={parseFloat(payingDoc.total)} pendingAmount={payingDoc.pending_amount ?? parseFloat(payingDoc.total)} hideDteFields={true} isRefund={payingDoc.dte_type === 'NOTA_CREDITO'} existingInvoice={{ dte_type: payingDoc.dte_type, number: payingDoc.number, document_attachment: null }} />}
            {receivingDoc && receivingDoc.purchase_order && <ReceiptModal open={!!receivingDoc} onOpenChange={(open) => !open && setReceivingDoc(null)} orderId={receivingDoc.purchase_order} onSuccess={fetchDocuments} isRefund={receivingDoc.dte_type === 'NOTA_CREDITO'} />}
            {notingDoc && <PurchaseNoteModal open={!!notingDoc} onOpenChange={(open) => !open && setNotingDoc(null)} orderId={notingDoc.purchase_order} orderNumber={notingDoc.purchase_order_number || notingDoc.purchase_order?.toString()} invoiceId={notingDoc.id} onSuccess={fetchDocuments} />}
            {completingDoc && <DocumentCompletionModal open={!!completingDoc} onOpenChange={(open) => !open && setCompletingDoc(null)} invoiceId={completingDoc.id} invoiceType={completingDoc.dte_type} contactId={completingDoc.partner || completingDoc.supplier} isPurchase={true} onComplete={async (invoiceId, formData) => { await api.post(`/billing/invoices/${invoiceId}/confirm/`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }) }} onSuccess={fetchDocuments} />}
            <ActionConfirmModal open={deleteConfirm.isOpen} onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }} onConfirm={deleteConfirm.confirm} title="Eliminar Documento" description="¿Está seguro de eliminar este documento? Esta acción no se puede deshacer." variant="destructive" />
            <ActionConfirmModal open={annulConfirm.isOpen} onOpenChange={(open) => { if (!open) annulConfirm.cancel() }} onConfirm={annulConfirm.confirm} title="Anular Documento" description="¿Está seguro de que desea ANULAR este documento?" variant="destructive" />
            <ActionConfirmModal open={forceAnnulConfirm.isOpen} onOpenChange={(open) => { if (!open) forceAnnulConfirm.cancel() }} onConfirm={forceAnnulConfirm.confirm} title="Desvincular y Anular Pagos" description="Este documento tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?" variant="destructive" />
        </div>
    )
}
