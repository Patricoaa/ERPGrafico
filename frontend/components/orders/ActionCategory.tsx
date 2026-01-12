'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getActionBadgeCount } from '@/lib/actions/utils'
import type { ActionCategory as ActionCategoryType, Action } from '@/types/actions'

// Import existing modals
import { DocumentCompletionModal } from '@/components/shared/DocumentCompletionModal'
import { ReceiptModal } from '@/components/purchasing/ReceiptModal'
import { PaymentDialog } from '@/components/shared/PaymentDialog'
import { PurchaseNoteModal } from '@/components/purchasing/PurchaseNoteModal'
import { SaleNoteModal } from '@/components/sales/SaleNoteModal'
import { TransactionViewModal } from '@/components/shared/TransactionViewModal'
import { DeliveryModal } from '@/components/sales/DeliveryModal'
import { PaymentReferenceModal } from '@/components/shared/PaymentReferenceModal'
import { toast } from 'sonner'
import api from '@/lib/api'

interface ActionCategoryProps {
    category: ActionCategoryType
    order: any
    orderType: 'purchase' | 'sale'
    onActionComplete: () => void
}

export function ActionCategory({
    category,
    order,
    orderType,
    onActionComplete
}: ActionCategoryProps) {
    const [activeModal, setActiveModal] = useState<string | null>(null)
    const [viewTransaction, setViewTransaction] = useState<any>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    const handleActionClick = async (action: Action) => {
        if (action.onClick) {
            action.onClick(order)
            return
        }

        // Handle special actions
        if (action.id === 'annul-document') {
            await handleAnnulDocument()
            return
        }

        if (action.id === 'delete-draft') {
            await handleDeleteDraft()
            return
        }

        // Open modal for other actions
        setActiveModal(action.id)
    }

    const handleAnnulDocument = async () => {
        const invoices = order.related_documents?.invoices || order.invoices
        const invoice = invoices?.find((inv: any) =>
            inv.status === 'POSTED' || inv.status === 'PAID'
        )

        if (!invoice) {
            toast.error('No se encontró un documento válido para anular')
            return
        }

        if (!confirm('¿Está seguro de que desea ANULAR este documento? Esta acción generará reversos contables y no se puede deshacer.')) {
            return
        }

        setIsProcessing(true)
        try {
            await api.post(`/billing/invoices/${invoice.id}/annul/`, {})
            toast.success('Documento anulado correctamente')
            onActionComplete()
        } catch (error: any) {
            console.error('Error annulling document:', error)
            const errorMessage = error.response?.data?.error || ''

            if (errorMessage.includes('Debe anular los pagos asociados')) {
                if (confirm('Este documento tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?')) {
                    try {
                        await api.post(`/billing/invoices/${invoice.id}/annul/`, { force: true })
                        toast.success('Documento y pagos anulados correctamente')
                        onActionComplete()
                    } catch (err: any) {
                        toast.error(err.response?.data?.error || 'Error al anular el documento')
                    }
                }
            } else {
                toast.error(errorMessage || 'Error al anular el documento')
            }
        } finally {
            setIsProcessing(false)
        }
    }

    const handleDeleteDraft = async () => {
        const invoices = order.related_documents?.invoices || order.invoices
        const draftInvoice = invoices?.find((inv: any) => inv.status === 'DRAFT')

        if (!draftInvoice) {
            toast.error('No se encontró un borrador para eliminar')
            return
        }

        if (!confirm('¿Está seguro de eliminar este documento borrador?')) {
            return
        }

        setIsProcessing(true)
        try {
            await api.delete(`/billing/invoices/${draftInvoice.id}/`)
            toast.success('Documento eliminado correctamente')
            onActionComplete()
        } catch (error: any) {
            console.error('Error deleting document:', error)
            toast.error(error.response?.data?.error || 'No se pudo eliminar el documento')
        } finally {
            setIsProcessing(false)
        }
    }

    const closeModal = () => {
        setActiveModal(null)
        setViewTransaction(null)
    }

    const handleSuccess = () => {
        closeModal()
        onActionComplete()
    }

    const handlePayment = async (data: any) => {
        const invoices = order.related_documents?.invoices || order.invoices
        const invoice = invoices?.find((inv: any) => inv.status === 'POSTED' || inv.status === 'PAID')
        if (!invoice) return

        try {
            const formData = new FormData()
            formData.append('amount', data.amount.toString())

            // Auto-detect direction based on document type and order type
            let paymentType = orderType === 'purchase' ? 'OUTBOUND' : 'INBOUND'
            const isCreditNote = invoice.dte_type === 'NOTA_CREDITO'
            if (isCreditNote) {
                paymentType = orderType === 'purchase' ? 'INBOUND' : 'OUTBOUND'
            }

            formData.append('payment_type', paymentType)
            formData.append('reference', `${invoice.dte_type === 'NOTA_CREDITO' ? 'NC' : invoice.dte_type === 'NOTA_DEBITO' ? 'ND' : 'PAGO'}-${invoice.number}`)

            if (orderType === 'purchase') {
                formData.append('purchase_order', order.id.toString())
            } else {
                formData.append('sale_order', order.id.toString())
            }

            formData.append('invoice', invoice.id.toString())
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
            toast.success('Operación registrada correctamente')
            handleSuccess()
        } catch (error: any) {
            console.error('Error registering payment:', error)
            toast.error(error.response?.data?.error || 'Error al registrar la operación')
        }
    }

    const CategoryIcon = category.icon

    return (
        <>
            <Card>
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <CategoryIcon className="h-4 w-4" />
                        {category.label}
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {category.actions.map(action => {
                        const ActionIcon = action.icon
                        const badgeCount = getActionBadgeCount(action, order)

                        return (
                            <Button
                                key={action.id}
                                variant={action.variant || 'outline'}
                                className="w-full justify-start"
                                onClick={() => handleActionClick(action)}
                                disabled={isProcessing}
                            >
                                <ActionIcon className="h-4 w-4 mr-2" />
                                <span className="flex-1 text-left">{action.label}</span>
                                {action.badge && (
                                    <Badge
                                        variant={action.badge.type as any}
                                        className="ml-2"
                                    >
                                        {badgeCount || action.badge.label}
                                    </Badge>
                                )}
                            </Button>
                        )
                    })}
                </CardContent>
            </Card>

            {/* Modals */}
            {activeModal === 'complete-folio' && (
                <DocumentCompletionModal
                    open={true}
                    onOpenChange={closeModal}
                    invoiceId={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status === 'DRAFT')?.id}
                    invoiceType={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status === 'DRAFT')?.dte_type}
                    onSuccess={handleSuccess}
                />
            )}

            {activeModal === 'register-reception' && orderType === 'purchase' && (
                <ReceiptModal
                    open={true}
                    onOpenChange={closeModal}
                    orderId={order.id}
                    onSuccess={handleSuccess}
                />
            )}

            {activeModal === 'register-delivery' && orderType === 'sale' && (
                <DeliveryModal
                    open={true}
                    onOpenChange={closeModal}
                    orderId={order.id}
                    onSuccess={handleSuccess}
                />
            )}

            {activeModal === 'register-payment' && (
                <PaymentDialog
                    open={true}
                    onOpenChange={closeModal}
                    onConfirm={handlePayment}
                    isPurchase={orderType === 'purchase'}
                    total={parseFloat(order.total)}
                    pendingAmount={order.pending_amount ?? parseFloat(order.total)}
                    hideDteFields={true}
                    isRefund={(order.related_documents?.invoices || order.invoices)?.some((inv: any) => inv.dte_type === 'NOTA_CREDITO')}
                    existingInvoice={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status === 'POSTED' || inv.status === 'PAID') ? {
                        dte_type: (order.related_documents?.invoices || order.invoices).find((inv: any) => inv.status === 'POSTED' || inv.status === 'PAID').dte_type,
                        number: (order.related_documents?.invoices || order.invoices).find((inv: any) => inv.status === 'POSTED' || inv.status === 'PAID').number,
                        document_attachment: (order.related_documents?.invoices || order.invoices).find((inv: any) => inv.status === 'POSTED' || inv.status === 'PAID').document_attachment || null
                    } : undefined}
                />
            )}

            {activeModal === 'register-payment-ref' && (
                <PaymentReferenceModal
                    open={true}
                    onOpenChange={closeModal}
                    payments={order.serialized_payments || order.related_documents?.payments}
                    onSuccess={handleSuccess}
                />
            )}

            {activeModal === 'create-note' && (
                orderType === 'purchase' ? (
                    <PurchaseNoteModal
                        open={true}
                        onOpenChange={closeModal}
                        orderId={order.id}
                        orderNumber={order.number}
                        invoiceId={(order.related_documents?.invoices || order.invoices)?.find((inv: any) =>
                            inv.status !== 'DRAFT' && !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type)
                        )?.id}
                        onSuccess={handleSuccess}
                    />
                ) : (
                    <SaleNoteModal
                        open={true}
                        onOpenChange={closeModal}
                        orderId={order.id}
                        orderNumber={order.number}
                        invoiceId={(order.related_documents?.invoices || order.invoices)?.find((inv: any) =>
                            inv.status !== 'DRAFT' && !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type)
                        )?.id}
                        onSuccess={handleSuccess}
                    />
                )
            )}

            {(activeModal === 'payment-history' || activeModal === 'view-documents' ||
                activeModal === 'view-receptions' || activeModal === 'view-deliveries') && (
                    <TransactionViewModal
                        open={true}
                        onOpenChange={closeModal}
                        type={orderType === 'purchase' ? 'purchase_order' : 'sale_order'}
                        id={order.id}
                        view={activeModal === 'payment-history' ? 'history' : 'details'}
                    />
                )}
        </>
    )
}
