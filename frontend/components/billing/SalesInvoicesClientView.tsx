"use client"

import { useState, useEffect } from "react"
import { DataTable } from "@/components/ui/data-table"
import { DataCell } from "@/components/ui/data-table-cells"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { ColumnDef } from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Eye, Banknote, History, X, FileBadge, Receipt, MoreVertical } from "lucide-react"
import { treasuryApi } from "@/features/treasury/api/treasuryApi"
import { useInvoices } from "@/features/billing/hooks/useInvoices"
import { Invoice } from "@/features/billing/types"
import { toast } from "sonner"
import { MoneyDisplay } from "@/components/shared/MoneyDisplay"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { SaleNoteModal } from "@/features/sales"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

export function SalesInvoicesClientView() {
    const { invoices, refetch, annulInvoice } = useInvoices()
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)
    const [notingInvoice, setNotingInvoice] = useState<Invoice | null>(null)
    const [payingInv, setPayingInv] = useState<Invoice | null>(null)
    const [selectedHub, setSelectedHub] = useState<{ orderId: number | null, invoiceId?: number | null }>({ orderId: null })

    const handleAnnul = async (id: number, force: boolean = false) => {
        if (!force && !confirm("¿Está seguro de que desea ANULAR este documento? Esta acción generará reversos contables y no se puede deshacer.")) return
        try {
            await annulInvoice({ id, force })
        } catch (error: any) {
            console.error("Error annulling invoice:", error)
            // Error handling for associated payments
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
        } catch (error: any) {
            console.error("Error registering payment:", error)
            toast.error(error.response?.data?.error || "Error al registrar la operación")
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
                                onClick={() => setSelectedHub({
                                    orderId: inv.sale_order,
                                    invoiceId: ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type) ? inv.id : null
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
                                                    className={disabled ? "text-muted-foreground opacity-50 cursor-not-allowed" : "text-purple-600"}
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
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Documentos Emitidos"
                description="Gestión de facturas y boletas de venta"
                icon={Receipt}
            />

            <DataTable
                columns={columns}
                data={invoices}
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

            <OrderCommandCenter
                orderId={selectedHub.orderId}
                invoiceId={selectedHub.invoiceId}
                type="sale"
                open={selectedHub.orderId !== null || !!selectedHub.invoiceId}
                onOpenChange={(open) => !open && setSelectedHub({ orderId: null })}
                onActionSuccess={refetch}
            />
        </div>
    )
}
