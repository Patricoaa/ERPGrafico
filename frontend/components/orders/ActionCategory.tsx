"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ActionButton } from "./ActionButton"
import { Action, ActionCategory as CategoryType } from "@/types/actions"
import { getActionBadgeCount } from "@/lib/actions/utils"
import { DocumentCompletionModal } from "../shared/DocumentCompletionModal"
import { DeliveryModal } from "../sales/DeliveryModal"
import { ReceiptModal } from "../purchasing/ReceiptModal"
import { PaymentHistoryModal } from "./PaymentHistoryModal"
import { PaymentDialog as PaymentModal } from "../shared/PaymentDialog"
import { PaymentReferenceModal } from "../shared/PaymentReferenceModal"
import { SaleNoteModal } from "../sales/SaleNoteModal"
import { PurchaseNoteModal } from "../purchasing/PurchaseNoteModal"
import { toast } from "sonner"
import api from "@/lib/api"

interface ActionCategoryProps {
    category: CategoryType
    order: any
    userPermissions: string[]
    onActionSuccess?: () => void
    layout?: 'list' | 'grid'
}

export function ActionCategory({
    category,
    order,
    userPermissions,
    onActionSuccess,
    layout = 'list'
}: ActionCategoryProps) {
    const [activeModal, setActiveModal] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)

    // Detemine order type helper
    const isSale = !!order.customer_name || !!order.customer
    const isPurchase = !!order.supplier_name || !!order.supplier

    const handleActionClick = (actionId: string) => {
        switch (actionId) {
            case 'complete-folio':
            case 'register-delivery':
            case 'view-payments':
            case 'register-payment':
            case 'register-payment-ref':
            case 'credit-note':
            case 'debit-note':
                setActiveModal(actionId)
                break
            case 'annul-document':
                handleAnnulDocument()
                break
            case 'delete-draft':
                handleDeleteDraft()
                break
            default:
                console.warn(`No handler for action: ${actionId}`)
        }
    }

    const closeModal = () => setActiveModal(null)

    const handleAnnulDocument = async (force: boolean = false) => {
        const invoices = order.related_documents?.invoices || order.invoices || []
        const invoice = invoices.find((inv: any) => inv.number !== 'Draft' && inv.status !== 'CANCELLED')

        if (!invoice) {
            toast.error("No se encontró un documento válido para anular")
            return
        }

        setIsProcessing(true)
        try {
            await api.post(`/billing/invoices/${invoice.id}/annul/`, { force })
            toast.success("Documento anulado correctamente")
            onActionSuccess?.()
        } catch (error: any) {
            console.error("Error annulling document:", error)
            const errorMessage = error.response?.data?.error || "Error al anular documento"

            if (errorMessage.includes("pagos asociados") && !force) {
                if (confirm("El documento tiene pagos asociados. ¿Deseas anular el documento y todos sus pagos?")) {
                    handleAnnulDocument(true)
                }
            } else {
                toast.error(errorMessage)
            }
        } finally {
            setIsProcessing(false)
        }
    }

    const handleDeleteDraft = async () => {
        const invoices = order.related_documents?.invoices || order.invoices || []
        const draftInvoice = invoices.find((inv: any) => inv.status === 'DRAFT' || inv.number === 'Draft')

        if (!draftInvoice) {
            toast.error("No se encontró un borrador para eliminar")
            return
        }

        if (!confirm("¿Estás seguro de que deseas eliminar este borrador?")) return

        setIsProcessing(true)
        try {
            await api.delete(`/billing/invoices/${draftInvoice.id}/`)
            toast.success("Borrador eliminado correctamente")
            onActionSuccess?.()
        } catch (error: any) {
            console.error("Error deleting draft:", error)
            toast.error("No se pudo eliminar el borrador")
        } finally {
            setIsProcessing(false)
        }
    }

    const handlePaymentConfirm = async (data: any) => {
        setIsProcessing(true)
        try {
            await api.post('/treasury/payments/', {
                ...data,
                [isSale ? 'sale_order' : 'purchase_order']: order.id,
                partner: (order.customer || order.supplier)?.id || (isSale ? order.customer_id : order.supplier_id)
            })
            toast.success("Pago registrado correctamente")
            closeModal()
            onActionSuccess?.()
        } catch (error: any) {
            console.error("Error registering payment:", error)
            toast.error(error.response?.data?.error || "Error al registrar pago")
        } finally {
            setIsProcessing(false)
        }
    }

    const filteredActions = category?.actions.filter(action => {
        if (action.requiredPermissions && !action.requiredPermissions.some(p => userPermissions.includes(p))) {
            return false
        }
        if (action.checkAvailability && !action.checkAvailability(order)) {
            return false
        }
        return true
    }) || []

    if (filteredActions.length === 0) return null

    const categoryBadgeCount = filteredActions.reduce((acc, action) => acc + (getActionBadgeCount(action, order) || 0), 0)

    return (
        <div className={layout === 'grid' ? "space-y-0" : "p-4 space-y-4 rounded-lg border bg-card/50"}>
            {layout === 'list' && (
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                        <category.icon className="h-4 w-4" />
                    </div>
                    <h3 className="font-semibold text-sm">{category.label}</h3>
                    {categoryBadgeCount > 0 && (
                        <Badge variant="secondary" className="ml-auto text-[10px] h-5">
                            {categoryBadgeCount}
                        </Badge>
                    )}
                </div>
            )}

            <div className={layout === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 gap-4" : "space-y-2"}>
                {filteredActions.map((action) => (
                    <ActionButton
                        key={action.id}
                        action={action}
                        order={order}
                        userPermissions={userPermissions}
                        onClick={() => handleActionClick(action.id)}
                        showBadge={true}
                    />
                ))}
            </div>

            {/* Modals */}
            {activeModal === 'complete-folio' && (
                <DocumentCompletionModal
                    open={true}
                    onOpenChange={closeModal}
                    invoiceId={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status === 'DRAFT' || inv.number === 'Draft')?.id}
                    invoiceType={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status === 'DRAFT' || inv.number === 'Draft')?.dte_type}
                    onSuccess={() => { closeModal(); onActionSuccess?.() }}
                />
            )}

            {activeModal === 'register-delivery' && (
                isSale ? (
                    <DeliveryModal
                        open={true}
                        onOpenChange={closeModal}
                        orderId={order.id}
                        onSuccess={() => { closeModal(); onActionSuccess?.() }}
                    />
                ) : (
                    <ReceiptModal
                        open={true}
                        onOpenChange={closeModal}
                        orderId={order.id}
                        onSuccess={() => { closeModal(); onActionSuccess?.() }}
                    />
                )
            )}

            {activeModal === 'view-payments' && (
                <PaymentHistoryModal
                    open={true}
                    onOpenChange={closeModal}
                    order={order}
                />
            )}

            {activeModal === 'register-payment' && (
                <PaymentModal
                    open={true}
                    onOpenChange={closeModal}
                    total={order.total}
                    pendingAmount={order.pending_amount ?? order.total}
                    onConfirm={handlePaymentConfirm}
                    isPurchase={isPurchase}
                />
            )}

            {activeModal === 'register-payment-ref' && (
                <PaymentReferenceModal
                    open={true}
                    onOpenChange={closeModal}
                    payments={order.related_documents?.payments || order.serialized_payments || []}
                    onSuccess={() => { closeModal(); onActionSuccess?.() }}
                />
            )}

            {activeModal === 'credit-note' && (
                isSale ? (
                    <SaleNoteModal
                        open={true}
                        onOpenChange={closeModal}
                        orderId={order.id}
                        orderNumber={order.number}
                        invoiceId={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status !== 'CANCELLED')?.id}
                        initialType="NOTA_CREDITO"
                        onSuccess={() => { closeModal(); onActionSuccess?.() }}
                    />
                ) : (
                    <PurchaseNoteModal
                        open={true}
                        onOpenChange={closeModal}
                        orderId={order.id}
                        orderNumber={order.number}
                        invoiceId={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status !== 'CANCELLED')?.id}
                        initialType="NOTA_CREDITO"
                        onSuccess={() => { closeModal(); onActionSuccess?.() }}
                    />
                )
            )}

            {activeModal === 'debit-note' && (
                isSale ? (
                    <SaleNoteModal
                        open={true}
                        onOpenChange={closeModal}
                        orderId={order.id}
                        orderNumber={order.number}
                        invoiceId={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status !== 'CANCELLED')?.id}
                        initialType="NOTA_DEBITO"
                        onSuccess={() => { closeModal(); onActionSuccess?.() }}
                    />
                ) : (
                    <PurchaseNoteModal
                        open={true}
                        onOpenChange={closeModal}
                        orderId={order.id}
                        orderNumber={order.number}
                        invoiceId={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status !== 'CANCELLED')?.id}
                        initialType="NOTA_DEBITO"
                        onSuccess={() => { closeModal(); onActionSuccess?.() }}
                    />
                )
            )}
        </div>
    )
}
