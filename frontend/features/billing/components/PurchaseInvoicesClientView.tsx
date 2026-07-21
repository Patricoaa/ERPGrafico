"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import React, { useState, useRef } from "react"
import { ActionConfirmModal, DocumentCompletionModal, UnifiedSearchBar, useUnifiedSearch } from '@/components/shared'
import { purchaseInvoiceUnifiedSearchDef } from "@/features/billing/unifiedSearchDef"
import { billingApi } from "@/features/billing/api/billingApi"
import { toast } from "sonner"
import { PaymentModal } from "@/features/treasury"
import { ReceiptModal } from "@/features/purchasing"
import { UnifiedNoteWizard } from '@/features/notes'
import { LazyDrawer } from "@/features/_shared"

import { DataTableView, AutoEntityCard } from '@/components/shared'
import { purchaseInvoiceFields } from "@/features/billing/purchaseInvoiceFields"
import { purchaseInvoiceActions, type PurchaseInvoiceActionsCtx } from "@/features/billing/purchaseInvoiceActions"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { useConfirmAction } from "@/hooks/useConfirmAction"

import { usePurchaseInvoices } from "@/features/billing/hooks/usePurchaseInvoices"
import { type Invoice, type InvoiceFilters } from "@/features/billing/types"
import { getDtePrefix, formatEntityDisplay, getEntityIcon } from "@/lib/entity-registry"

interface Props {
    createAction?: React.ReactNode
}

export function PurchaseInvoicesClientView({ createAction }: Props) {
    const search = useUnifiedSearch(purchaseInvoiceUnifiedSearchDef)
    const { invoices: documents, isLoading, refetch: fetchDocuments } = usePurchaseInvoices({ filters: { ...search.filters } as InvoiceFilters })
    const [payingDoc, setPayingDoc] = useState<Invoice | null>(null)
    const [receivingDoc, setReceivingDoc] = useState<Invoice | null>(null)
    const [notingDoc, setNotingDoc] = useState<Invoice | null>(null)
    const [completingDoc, setCompletingDoc] = useState<Invoice | null>(null)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: string; id: string } | null>(null)

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
            const prefix = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(payingDoc.dte_type) ? getDtePrefix(payingDoc.dte_type) : 'PAGO'
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

    const toggleHub = (doc: Invoice) => {
        const isSelected = hubConfig?.invoiceId === doc.id
        if (isSelected && isHubOpen) {
            closeHub()
        } else {
            openHub({
                orderId: doc.purchase_order || null,
                invoiceId: ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(doc.dte_type) ? doc.id : null,
                type: 'purchase',
                onActionSuccess: fetchDocuments,
            })
        }
    }

    const actionsCtx: PurchaseInvoiceActionsCtx = {
        onDetail: (doc) => setViewingTransaction({ type: 'invoice', id: String(doc.id) }),
        onPay: (doc) => setPayingDoc(doc),
        onHub: (doc) => toggleHub(doc),
        onReceive: (doc) => setReceivingDoc(doc),
        onCompleteFolio: (doc) => setCompletingDoc(doc),
        onCreateNote: (doc) => setNotingDoc(doc),
        onPaymentHistory: (doc) => setViewingTransaction({ type: 'invoice', id: String(doc.id) }),
        onDelete: (id) => deleteConfirm.requestConfirm(id),
        onAnnul: (id) => annulConfirm.requestConfirm(id),
    }

    const columns = [
        ...purchaseInvoiceFields.toColumns(),
        purchaseInvoiceActions.auto(actionsCtx),
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="billing.invoice"
                    defaultView="card"
                    columns={columns}
                    data={documents}
                    isLoading={isLoading}
                    onRowClick={(row: Invoice) => toggleHub(row)}
                    variant="embedded"
                    unifiedSearch={<UnifiedSearchBar
                        config={purchaseInvoiceUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar facturas de compra..."
                    />}
                    unifiedSearchConfig={purchaseInvoiceUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    defaultPageSize={20}
                    createAction={createAction}
                    isSelected={(inv: Invoice) => hubConfig?.invoiceId === inv.id}
                    isHubOpen={isHubOpen}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "purchase",
                        title: "Aún no hay documentos de compra",
                        description: "Los documentos de compra registrados aparecerán aquí.",
                    }}
                    renderCard={(data: Invoice) => (
                        <AutoEntityCard
                            key={data.id}
                            data={data}
                            fields={purchaseInvoiceFields}
                            entityLabel="billing.invoice"
                            icon={getEntityIcon('billing.invoice')}
                            iconClassName="text-info bg-info/10"
                            isSelected={hubConfig?.invoiceId === data.id}
                            onClick={() => toggleHub(data)}
                            hubTrigger={{
                                isSelected: hubConfig?.invoiceId === data.id,
                                onToggle: () => toggleHub(data),
                            }}
                        />
                    )}
                />
            </div>

            {viewingTransaction && (
                <LazyDrawer
                    type={viewingTransaction.type}
                    id={Number(viewingTransaction.id)}
                    open={!!viewingTransaction}
                    onOpenChange={(open: boolean) => !open && setViewingTransaction(null)}
                />
            )}

            {payingDoc && (
                <PaymentModal
                    open={!!payingDoc}
                    onOpenChange={(open) => !open && setPayingDoc(null)}
                    onConfirm={handlePayment}
                    isPurchase={true}
                    total={parseFloat(payingDoc.total)}
                    pendingAmount={payingDoc.pending_amount ?? parseFloat(payingDoc.total)}
                    hideDteFields={true}
                    isRefund={payingDoc.dte_type === 'NOTA_CREDITO'}
                    existingInvoice={{ dte_type: payingDoc.dte_type, number: payingDoc.number ?? '', document_attachment: null }}
                />
            )}

            {receivingDoc && receivingDoc.purchase_order && (
                <ReceiptModal
                    open={!!receivingDoc}
                    onOpenChange={(open) => !open && setReceivingDoc(null)}
                    orderId={receivingDoc.purchase_order}
                    onSuccess={fetchDocuments}
                    isRefund={receivingDoc.dte_type === 'NOTA_CREDITO'}
                />
            )}

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

            {completingDoc && (
                <DocumentCompletionModal
                    open={!!completingDoc}
                    onOpenChange={(open) => !open && setCompletingDoc(null)}
                    invoiceId={completingDoc.id}
                    invoiceType={completingDoc.dte_type}
                    contactId={completingDoc.partner || completingDoc.supplier}
                    isPurchase={true}
                    onComplete={async (invoiceId, formData) => {
                        await billingApi.confirmInvoice(invoiceId, formData)
                    }}
                    onSuccess={fetchDocuments}
                />
            )}

            <ActionConfirmModal open={deleteConfirm.isOpen} onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }} onConfirm={deleteConfirm.confirm} title="Cancelar Documento" description="¿Está seguro de cancelar este documento?" variant="destructive" />
            <ActionConfirmModal open={annulConfirm.isOpen} onOpenChange={(open) => { if (!open) annulConfirm.cancel() }} onConfirm={(reason) => { annulReasonRef.current = reason ?? ''; return annulConfirm.confirm() }} title="Anular Documento" description="¿Está seguro de que desea ANULAR este documento?" variant="destructive" requireReason reasonLabel="Motivo de la anulación" />
            <ActionConfirmModal open={forceAnnulConfirm.isOpen} onOpenChange={(open) => { if (!open) forceAnnulConfirm.cancel() }} onConfirm={forceAnnulConfirm.confirm} title="Desvincular y Anular Pagos" description="Este documento tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?" variant="destructive" />
        </div>
    )
}
