"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import { useState, useEffect } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Banknote, History, X, FileBadge, Receipt, MoreVertical, Package } from "lucide-react"
import { treasuryApi } from "@/features/treasury/api/treasuryApi"
import { useInvoices } from "@/features/billing/hooks/useInvoices"
import { Invoice } from "@/features/billing/types"
import { EmptyState } from "@/components/shared/EmptyState"
import { toast } from "sonner"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { SaleNoteModal } from "@/features/sales"
import { PaymentDialog } from "@/features/treasury/components/PaymentDialog"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { InvoiceCard } from "@/features/billing/components/InvoiceCard"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

export function SalesInvoicesClientView() {
    const { invoices, refetch, annulInvoice } = useInvoices()
    const { openHub } = useHubPanel()
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)
    const [notingInvoice, setNotingInvoice] = useState<Invoice | null>(null)
    const [payingInv, setPayingInv] = useState<Invoice | null>(null)

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

    const handleAnnul = (id: number) => {
        annulConfirm.requestConfirm(id)
    }

    const handlePayment = async (data: any) => {
        if (!payingInv) return
        try {
            const formData = new FormData()
            formData.append('amount', data.amount.toString())
            let paymentType = 'INBOUND'
            if (payingInv.dte_type === 'NOTA_CREDITO') paymentType = 'OUTBOUND'
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

            await treasuryApi.createPayment(formData)
            toast.success("Operación registrada correctamente")
            setPayingInv(null)
            refetch()
        } catch (error: unknown) {
            console.error("Error registering payment:", error)
            showApiError(error, "Error al registrar la operación")
        }
    }

    const columns: ColumnDef<Invoice>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" />,
            cell: ({ row }) => <DataCell.DocumentId type={row.original.dte_type} number={row.original.number} />,
        },
        { accessorKey: "date", header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" /> },
        { accessorKey: "dte_type_display", header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" /> },
        { accessorKey: "partner_name", header: ({ column }) => <DataTableColumnHeader column={column} title="Cliente" /> },
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
                        {inv.sale_order ? (
                            <Button
                                variant="default"
                                size="sm"
                                onClick={() => openHub({
                                    orderId: inv.sale_order,
                                    invoiceId: ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type) ? inv.id : null,
                                    type: 'sale',
                                    onActionSuccess: refetch
                                })}
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
                                        {!['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type) && (() => {
                                            const isDraft = inv.status === 'DRAFT'
                                            const isPaid = inv.status === 'PAID'
                                            const isDelivered = inv.sale_order ? inv.order_delivery_status === 'DELIVERED' : true
                                            const disabled = isDraft || !isPaid || !isDelivered
                                            let tooltipText = ""
                                            if (isDraft) tooltipText = "La factura debe estar publicada (no borrador)"
                                            else if (!isPaid) tooltipText = "La factura debe estar completamente pagada"
                                            else if (!isDelivered) tooltipText = "La logística debe estar completamente finalizada"
                                            const ButtonComponent = (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={disabled ? "text-muted-foreground opacity-50 cursor-not-allowed" : "text-primary"}
                                                    onClick={() => !disabled && setNotingInvoice(inv)}
                                                    disabled={disabled}
                                                    title={disabled ? "" : "Registrar Nota Crédito/Débito"}
                                                >
                                                    <FileBadge className="h-4 w-4" />
                                                </Button>
                                            )
                                            if (disabled) {
                                                return (
                                                    <TooltipProvider delayDuration={0}>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild><div>{ButtonComponent}</div></TooltipTrigger>
                                                            <TooltipContent><p>{tooltipText}</p></TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )
                                            }
                                            return ButtonComponent
                                        })()}
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
        <div className="space-y-4 px-1">

            <DataTable
                columns={columns}
                data={invoices}
                cardMode
                filterColumn="partner_name"
                searchPlaceholder="Buscar por cliente..."
                facetedFilters={[
                    {
                        column: "status",
                        title: "Estado",
                        options: [
                            { label: "Borrador", value: "DRAFT" },
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
                                <EmptyState
                                    context="search"
                                    title="No hay documentos"
                                    description="No se encontraron facturas o boletas emitidas."
                                />
                            </div>
                        )
                    }
                    return (
                        <div className="grid gap-3 pt-2">
                            {rows.map((row: any) => {
                                const inv = row.original as Invoice
                                return (
                                    <InvoiceCard
                                        key={inv.id}
                                        item={inv}
                                        type="sale_invoice"
                                        onClick={() => {
                                            openHub({
                                                orderId: inv.sale_order || null,
                                                invoiceId: inv.id,
                                                type: 'sale',
                                                onActionSuccess: refetch
                                            })
                                        }}
                                    />
                                )
                            })}
                        </div>
                    )
                }}
            />



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
                    orderId={notingInvoice.sale_order || undefined}
                    orderNumber={notingInvoice.sale_order_number || undefined}
                    invoiceId={notingInvoice.id}
                    onSuccess={refetch}
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
                    existingInvoice={{ dte_type: payingInv.dte_type || '', number: payingInv.number || '', document_attachment: null }}
                />
            )}

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
