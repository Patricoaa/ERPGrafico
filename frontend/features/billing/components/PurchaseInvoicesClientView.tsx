"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import React, { useState, useRef } from "react"
import { type ColumnDef } from "@tanstack/react-table"
import {ActionConfirmModal, DocumentCompletionModal, SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation} from '@/components/shared'
import { purchaseInvoiceSearchDef } from '../searchDef'
import { purchaseInvoiceSegDef } from "@/features/billing/segmentationDef"
import { FileBadge } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { formatCurrency } from "@/lib/money"
import { billingApi } from "@/features/billing/api/billingApi"
import { toast } from "sonner"
import { PaymentModal } from "@/features/treasury/components/PaymentModal"
import { ReceiptModal } from "@/features/purchasing/components/ReceiptModal"
import { UnifiedNoteWizard } from '@/features/notes'

import { DataTableView, createCodeColumn, createDateColumn, createCurrencyColumn, createContactColumn, DataTableColumnHeader } from '@/components/shared'
import { DataCell } from '@/components/shared'
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { usePurchaseInvoices } from "@/features/billing/hooks/usePurchaseInvoices"
import { type Invoice, type InvoiceFilters } from "@/features/billing/types"
import { getDtePrefix, formatEntityDisplay } from "@/lib/entity-registry"

export function PurchaseInvoicesClientView() {
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(purchaseInvoiceSearchDef)
    const basePeriod = { serverParamFrom: 'date_from', serverParamTo: 'date_to' }
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(purchaseInvoiceSegDef, basePeriod)
    const isFiltered = isTextFiltered || isSegFiltered
    const { invoices: documents, isLoading, refetch: fetchDocuments } = usePurchaseInvoices({ filters: { ...(textFilters as Omit<InvoiceFilters, 'mode'>), ...(segFilters as Record<string, string>) } })
    const [payingDoc, setPayingDoc] = useState<Invoice | null>(null)
    const [receivingDoc, setReceivingDoc] = useState<Invoice | null>(null)
    const [notingDoc, setNotingDoc] = useState<Invoice | null>(null)
    const [completingDoc, setCompletingDoc] = useState<Invoice | null>(null)

    const { openHub, closeHub, hubConfig, isHubOpen } = useHubPanel()

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await billingApi.cancelInvoice(id)
            toast.success("Documento cancelado correctamente")
            fetchDocuments()
        } catch (error: unknown) {
            console.error("Error deleting document:", error)
            showApiError(error, "No se pudo eliminar el documento")
        }
    })

    // El motivo se captura en el modal de anulación y se reutiliza en el force-retry
    const annulReasonRef = useRef('')

    const forceAnnulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await billingApi.annulInvoice(id, { force: true, reason: annulReasonRef.current })
            toast.success("Documento anulado correctamente.")
            fetchDocuments()
        } catch (error: unknown) {
            toast.error(getErrorMessage(error) || "Error al anular el documento.")
        }
    })

    const annulConfirm = useConfirmAction<number>(async (id) => {
        try {
            await billingApi.annulInvoice(id, { force: false, reason: annulReasonRef.current })
            toast.success("Documento anulado correctamente.")
            fetchDocuments()
        } catch (error: unknown) {
            console.error("Error annulling invoice:", error)
            const errorMessage = getErrorMessage(error) || ""

            if (errorMessage.includes("pagos")) {
                forceAnnulConfirm.requestConfirm(id)
                return
            }

            toast.error(errorMessage || "Error al anular el documento.")
        }
    })

    const handlePayment = async (data: Record<string, unknown>) => {
        if (!payingDoc) return
        const d = data as unknown as { amount: number; paymentMethod: string; transaction_number?: string; is_pending_registration?: boolean; treasury_account_id?: string | number; dteType?: string; document_reference?: string; document_date?: string; document_attachment?: File | Blob }
        try {
            const formData = new FormData()
            formData.append('amount', d.amount.toString())

            let paymentType = 'OUTBOUND'
            const isCreditNote = payingDoc.dte_type === 'NOTA_CREDITO'
            if (isCreditNote) paymentType = 'INBOUND'

            formData.append('payment_type', paymentType)
            const prefix = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(payingDoc.dte_type) ? getDtePrefix(payingDoc.dte_type) : 'PAGO';
            formData.append('reference', `${prefix}-${payingDoc.number ?? ''}`)
            formData.append('purchase_order', payingDoc.purchase_order ? payingDoc.purchase_order.toString() : '')
            formData.append('invoice', payingDoc.id.toString())
            formData.append('payment_method', d.paymentMethod)

            if (d.transaction_number) formData.append('transaction_number', d.transaction_number)
            if (d.is_pending_registration !== undefined) formData.append('is_pending_registration', d.is_pending_registration.toString())
            if (d.treasury_account_id) formData.append('treasury_account_id', String(d.treasury_account_id))
            if (d.dteType) formData.append('dte_type', d.dteType)
            if (d.document_reference) formData.append('document_reference', d.document_reference)
            if (d.document_date) formData.append('document_date', d.document_date)
            if (d.document_attachment) formData.append('document_attachment', d.document_attachment)

            await billingApi.createPayment(formData)
            toast.success("Operación registrada correctamente")
            setPayingDoc(null)
            fetchDocuments()
        } catch (error: unknown) {
            console.error("Error registering payment:", error)
            showApiError(error, "Error al registrar la operación")
        }
    }

    const columns: ColumnDef<Invoice>[] = [
        createCodeColumn<Invoice>("number", "Folio", {
            render: (row) => <>{row.display_id ?? row.number}</>,
        }),
        createDateColumn<Invoice>("date", "Fecha"),
        {
            accessorKey: "dte_type",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
            cell: ({ row }) => {
                const doc = row.original
                const label = getDtePrefix(doc.dte_type)
                return (
                    <div className="flex items-center gap-2 justify-center w-full">
                        <FileBadge className="h-3.5 w-3.5 text-muted-foreground/50" />
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <DataCell.Secondary>
                                    {label}
                                </DataCell.Secondary>
                            </TooltipTrigger>
                            <TooltipContent side="top">{doc.dte_type_display || doc.dte_type}</TooltipContent>
                        </Tooltip>
                    </div>
                )
            },
        },
        createContactColumn<Invoice>("partner_name", "Proveedor", "partner"),
        createCurrencyColumn<Invoice>("total", "Total"),
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
                            subLabel={formatCurrency(paid)}
                        />
                    </div>
                )
            },
        },
        {
            id: "hub_trigger",
            header: () => null,
            cell: ({ row }) => {
                const item = row.original
                const isSelected = hubConfig?.invoiceId === item.id
                return (
                    <div className="flex justify-end pr-2">
                        <DataCell.Action
                            action="hub"
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
                        />
                    </div>
                )
            },
        },
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="billing.invoice"
                    columns={columns}
                    data={documents}
                    isLoading={isLoading}
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
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={purchaseInvoiceSearchDef} placeholder="Buscar facturas de compra..." className="w-full" />}
                    segmentation={<SegmentationBar def={purchaseInvoiceSegDef} basePeriod={basePeriod} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    defaultPageSize={20}
                    isSelected={(inv: Invoice) => hubConfig?.invoiceId === inv.id}
                    isHubOpen={isHubOpen}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "purchase",
                        title: "Aún no hay documentos de compra",
                        description: "Los documentos de compra registrados aparecerán aquí.",
                    }}
                    cardGroupBy={{ field: 'date', sort: 'desc', aggregators: [{ key: 'total', label: 'Total', field: 'total', fn: 'sum', format: 'money' }, { key: 'count', label: 'Items', fn: 'count', format: 'integer' }] }}
                />
            </div>
            {payingDoc && <PaymentModal open={!!payingDoc} onOpenChange={(open) => !open && setPayingDoc(null)} onConfirm={handlePayment} isPurchase={true} total={parseFloat(payingDoc.total)} pendingAmount={payingDoc.pending_amount ?? parseFloat(payingDoc.total)} hideDteFields={true} isRefund={payingDoc.dte_type === 'NOTA_CREDITO'} existingInvoice={{ dte_type: payingDoc.dte_type, number: payingDoc.number ?? '', document_attachment: null }} />}
            {receivingDoc && receivingDoc.purchase_order && <ReceiptModal open={!!receivingDoc} onOpenChange={(open) => !open && setReceivingDoc(null)} orderId={receivingDoc.purchase_order} onSuccess={fetchDocuments} isRefund={receivingDoc.dte_type === 'NOTA_CREDITO'} />}
            {notingDoc && (
                <UnifiedNoteWizard
                    open={!!notingDoc}
                    onOpenChange={(open) => !open && setNotingDoc(null)}
                    mode="purchase"
                    initialType="NOTA_CREDITO"
                    allowTypeChange={true}
                    features={{ reviewStep: true }}
                    supplierName={notingDoc.partner_name ?? undefined}
                    orderReference={notingDoc.purchase_order_number?.toString() ?? notingDoc.purchase_order?.toString()}
                    referenceLabel={notingDoc.purchase_order ? formatEntityDisplay('purchasing.purchaseorder', { number: notingDoc.purchase_order_number ?? notingDoc.purchase_order }) : `Factura #${notingDoc.id}`}
                    fetchSource={async () => {
                        const { purchasingApi } = await import('@/features/purchasing/api/purchasingApi')
                        const source = notingDoc.purchase_order
                            ? (await purchasingApi.getOrder(notingDoc.purchase_order) as unknown) as Record<string, unknown>
                            : (await purchasingApi.getInvoice(notingDoc.id) as unknown) as Record<string, unknown>
                        const rawLines = (source.lines as Record<string, unknown>[]) || []
                        const normLines = rawLines.map((l: Record<string, unknown>) => ({
                            lineId: l.id as number,
                            productId: l.product as number,
                            productName: String(l.product_name || l.description || ''),
                            productCode: l.product_code as string | undefined,
                            uomName: l.uom_name as string | undefined,
                            originalQuantity: Number(l.quantity) || 0,
                            noteQuantity: 0,
                            noteUnitPrice: parseFloat(String(l.unit_cost || l.unit_price || '0')),
                        }))
                        return {
                            label: notingDoc.purchase_order ? formatEntityDisplay('purchasing.purchaseorder', { number: source.number as string }) : `Factura #${notingDoc.id}`,
                            isExempt: false,
                            originalTotal: Number(source.total) || 0,
                            supplierName: source.supplier_name as string | undefined,
                            warehouseName: source.warehouse_name as string | undefined,
                            contactId: typeof source.supplier === 'object' ? (source.supplier as Record<string, unknown>)?.id as number : source.supplier as number | undefined,
                            lines: normLines,
                        }
                    }}
                    onSubmit={async (payload) => {
                        const { purchasingApi } = await import('@/features/purchasing/api/purchasingApi')
                        const { PricingUtils } = await import('@/lib/pricing-utils')
                        const formData = new FormData()
                        formData.append('note_type', payload.noteType)
                        formData.append('document_number', payload.registration.documentNumber)
                        formData.append('document_date', payload.registration.documentDate)
                        formData.append('amount_net', payload.totalNet.toString())
                        formData.append('amount_tax', PricingUtils.calculateTax(payload.totalNet).toString())
                        const returnItems = payload.lines
                            .filter(l => l.noteQuantity > 0)
                            .map(l => ({ product_id: l.productId, quantity: l.noteQuantity, unit_cost: l.noteUnitPrice }))
                        formData.append('return_items', JSON.stringify(returnItems))
                        if (payload.registration.attachment) formData.append('document_attachment', payload.registration.attachment)
                        if (payload.payment.method || payload.payment.amount > 0) formData.append('payment_data', JSON.stringify(payload.payment))
                        if (notingDoc.purchase_order) {
                            formData.append('original_invoice_id', notingDoc.id.toString())
                            await purchasingApi.registerNote(notingDoc.purchase_order, formData)
                        } else {
                            await purchasingApi.registerInvoiceNote(notingDoc.id, formData)
                        }
                    }}
                    onSuccess={fetchDocuments}
                />
            )}
            {completingDoc && <DocumentCompletionModal open={!!completingDoc} onOpenChange={(open) => !open && setCompletingDoc(null)} invoiceId={completingDoc.id} invoiceType={completingDoc.dte_type} contactId={completingDoc.partner || completingDoc.supplier} isPurchase={true} onComplete={async (invoiceId, formData) => { await billingApi.confirmInvoice(invoiceId, formData) }} onSuccess={fetchDocuments} />}
            <ActionConfirmModal open={deleteConfirm.isOpen} onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }} onConfirm={deleteConfirm.confirm} title="Cancelar Documento" description="¿Está seguro de cancelar este documento?" variant="destructive" />
            <ActionConfirmModal open={annulConfirm.isOpen} onOpenChange={(open) => { if (!open) annulConfirm.cancel() }} onConfirm={(reason) => { annulReasonRef.current = reason ?? ''; return annulConfirm.confirm() }} title="Anular Documento" description="¿Está seguro de que desea ANULAR este documento?" variant="destructive" requireReason reasonLabel="Motivo de la anulación" />
            <ActionConfirmModal open={forceAnnulConfirm.isOpen} onOpenChange={(open) => { if (!open) forceAnnulConfirm.cancel() }} onConfirm={forceAnnulConfirm.confirm} title="Desvincular y Anular Pagos" description="Este documento tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?" variant="destructive" />
        </div>
    )
}
