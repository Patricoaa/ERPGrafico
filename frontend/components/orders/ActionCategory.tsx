"use client"

import { useState, forwardRef, useImperativeHandle } from "react"
import { cn } from "@/lib/utils"
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
import { DocumentListModal } from './DocumentListModal'
import { TransactionViewModal } from "../shared/TransactionViewModal"
import api from "@/lib/api"

import { useRouter } from "next/navigation"

interface ActionCategoryProps {
    category: CategoryType
    order: any
    userPermissions: string[]
    onActionSuccess?: () => void
    layout?: 'list' | 'grid' | 'flex'
    compact?: boolean
    ghost?: boolean
    showBadge?: boolean
}

export const ActionCategory = forwardRef(({
    category,
    order,
    userPermissions,
    onActionSuccess,
    layout = 'list',
    compact = false,
    ghost = false,
    showBadge = true
}: ActionCategoryProps, ref) => {
    const router = useRouter()
    const [activeModal, setActiveModal] = useState<string | null>(null)
    const [isProcessing, setIsProcessing] = useState(false)
    const [tempInvoiceId, setTempInvoiceId] = useState<number | null>(null)

    useImperativeHandle(ref, () => ({
        handleActionClick
    }))

    // Detemine order type helper
    const isSale = !!order.customer_name || !!order.customer
    const isPurchase = !!order.supplier_name || !!order.supplier

    const [viewConfig, setViewConfig] = useState<{ type: any, id: any } | null>(null)

    const handleActionClick = (actionId: string) => {
        console.log(`[ActionEngine] Handling action click: ${actionId}`, { orderId: order?.id });
        const action = category.actions.find(a => a.id === actionId)
        if (action?.onClick) {
            action.onClick(order)
            return
        }

        switch (actionId) {
            case 'complete-folio':
            case 'register-delivery':
            case 'register-reception':
            case 'confirm-service-delivery':
            case 'payment-history':
            case 'register-payment':
            case 'register-payment-ref':
            case 'create-note':
                setActiveModal(actionId)
                break
            case 'view-documents':
            case 'view-receptions':
            case 'view-deliveries':
                const docs = actionId === 'view-documents'
                    ? (order.related_documents?.invoices || order.invoices || [])
                    : (isSale ? (order.related_documents?.deliveries || []) : (order.related_documents?.receipts || []))

                if (docs.length === 0) {
                    toast.error("No se han encontrado documentos.")
                    return
                }

                // If only one, open directly. If multiple, eventually we might need a list, 
                // but user wants TransactionViewModal. We'll open the latest one.
                const targetDoc = docs[0]
                const viewType = actionId === 'view-documents' ? 'invoice' : 'inventory'
                const viewId = actionId === 'view-documents' ? targetDoc.id : (targetDoc.id || targetDoc.stock_move_id)

                if (!viewId) {
                    toast.error("Error al identificar el documento.")
                    return
                }

                setViewConfig({ type: viewType, id: viewId })
                setActiveModal('transaction-view')
                break
            case 'regenerate-document':
                handleRegenerateDocument()
                break
            case 'create-work-order':
                router.push(`/production/work-orders/new?sale_order_id=${order.id}`)
                break
            case 'view-work-orders':
                // For Work Orders we'll keep it as a list for now or open specific one
                setActiveModal(actionId)
                break
            case 'annul-document':
                handleAnnulDocument()
                break
            case 'delete-draft':
                handleDeleteDraft()
                break
            case 'register-merchandise-return':
                setActiveModal(actionId)
                break
            case 'register-payment-return':
                setActiveModal(actionId)
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

    const handleRegenerateDocument = async () => {
        setIsProcessing(true)
        try {
            // We need a dummy DTE_TYPE and PAYMENT_METHOD to init the draft, later the user can change it in the completion modal?
            // Actually, create_from_order requires dte_type and payment_method. 
            // We'll infer defaults or ask backend to handle a 'DRAFT' init.
            // Since we want to open the "Complete Folio" modal which ASKS for dte_type, 
            // maybe we should just create a placeholder draft.
            // However, our backend create_from_order expects data.
            // Let's try sending defaults, the user will confirm in the next step.

            const response = await api.post('/billing/invoices/create_from_order/', {
                order_id: order.id,
                order_type: isSale ? 'sale' : 'purchase',
                dte_type: 'FACTURA_ELECTRONICA', // Default, will change in completion
                payment_method: 'CREDIT'
            })

            setTempInvoiceId(response.data.id)
            setActiveModal('complete-folio')
            onActionSuccess?.()
        } catch (error: any) {
            console.error("Error regenerating document:", error)
            toast.error(error.response?.data?.error || "Error al re-emitir documento")
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
                payment_type: isSale ? 'INBOUND' : 'OUTBOUND',
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

    const categoryBadgeCount = filteredActions.reduce((acc, action) => acc + (getActionBadgeCount(action, order) || 0), 0)

    // Only return null if there are no actions AND no active modal to show
    if (filteredActions.length === 0 && !activeModal) return null

    return (
        <div className={cn(
            layout === 'grid' ? "space-y-0" : (ghost || layout === 'flex' ? "space-y-2" : "p-4 space-y-4 rounded-lg border bg-card/50")
        )}>
            {layout === 'list' && (category.icon || category.label) && (
                <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                    {category.icon && (
                        <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                            <category.icon className="h-4 w-4" />
                        </div>
                    )}
                    {category.label && <h3 className="font-semibold text-sm">{category.label}</h3>}
                    {categoryBadgeCount > 0 && (
                        <Badge variant="secondary" className="ml-auto text-[10px] h-5">
                            {categoryBadgeCount}
                        </Badge>
                    )}
                </div>
            )}

            <div className={cn(
                layout === 'grid' ? (compact ? "grid grid-cols-1 gap-2" : "grid grid-cols-1 sm:grid-cols-2 gap-4") :
                    layout === 'flex' ? "flex flex-wrap items-center justify-center gap-2" :
                        "space-y-2"
            )}>
                {filteredActions.map((action) => (
                    <ActionButton
                        key={action.id}
                        action={action}
                        order={order}
                        userPermissions={userPermissions}
                        onClick={() => handleActionClick(action.id)}
                        showBadge={showBadge}
                        compact={compact}
                        ghost={ghost}
                        className={layout === 'flex' ? "w-auto" : ""}
                    />
                ))}
            </div>

            {/* Modals */}
            {activeModal === 'complete-folio' && (
                <DocumentCompletionModal
                    open={true}
                    onOpenChange={closeModal}
                    invoiceId={tempInvoiceId || (order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status === 'DRAFT' || inv.number === 'Draft')?.id}
                    invoiceType={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status === 'DRAFT' || inv.number === 'Draft')?.dte_type}
                    onSuccess={() => { closeModal(); onActionSuccess?.() }}
                />
            )}

            {(activeModal === 'register-delivery' || activeModal === 'register-reception' || activeModal === 'confirm-service-delivery') && (
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
                        filterType={activeModal === 'confirm-service-delivery' ? 'SERVICE' : (activeModal === 'register-reception' ? 'PRODUCT' : 'ALL')}
                    />
                )
            )}

            {activeModal === 'payment-history' && (
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

            {activeModal === 'create-note' && (
                isSale ? (
                    <SaleNoteModal
                        open={true}
                        onOpenChange={closeModal}
                        orderId={order.id}
                        orderNumber={order.number}
                        invoiceId={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status !== 'CANCELLED' && !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type))?.id}
                        initialType="NOTA_CREDITO"
                        onSuccess={() => { closeModal(); onActionSuccess?.() }}
                    />
                ) : (
                    <PurchaseNoteModal
                        open={true}
                        onOpenChange={closeModal}
                        orderId={order.id}
                        orderNumber={order.number}
                        invoiceId={(order.related_documents?.invoices || order.invoices)?.find((inv: any) => inv.status !== 'CANCELLED' && !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type))?.id}
                        initialType="NOTA_CREDITO"
                        onSuccess={() => { closeModal(); onActionSuccess?.() }}
                    />
                )
            )}

            {activeModal === 'transaction-view' && viewConfig && (
                <TransactionViewModal
                    open={true}
                    onOpenChange={closeModal}
                    type={viewConfig.type}
                    id={viewConfig.id}
                />
            )}

            {activeModal === 'view-work-orders' && (
                <DocumentListModal
                    open={true}
                    onOpenChange={closeModal}
                    type="work_orders"
                    data={order.work_orders || []}
                    onItemClick={(type, id) => {
                        setViewConfig({ type, id })
                        setActiveModal('transaction-view')
                    }}
                />
            )}
        </div>
    )
})
