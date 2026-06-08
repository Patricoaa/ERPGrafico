"use client"

import { showApiError, getErrorMessage } from "@/lib/errors"
import { useState, useEffect, forwardRef, useImperativeHandle, Suspense } from "react"
import { cn } from "@/lib/utils"
import { ActionConfirmModal, Chip } from '@/components/shared'
import { ActionButton } from "./ActionButton"
import {ActionCategory as CategoryType} from "@/types/actions"
import { getActionBadgeCount } from '@/lib/action-utils'
import dynamic from "next/dynamic"
import { toast } from "sonner"

import { SkeletonShell } from "@/components/shared"

// Lazy Loaded Modals to satisfy PERF-01 (Prevent massive bundle on Hub Engine)
// Lazy Loaded Modals - More robust import pattern to handle default/named exports and prevent load failures
const DocumentCompletionModal = dynamic(() => import("@/components/shared/DocumentCompletionModal").then(m => m.DocumentCompletionModal))
const DeliveryDrawer = dynamic(() => import("@/features/sales").then(m => m.DeliveryDrawer))
const ReceiptModal = dynamic(() => import("@/features/purchasing/components/ReceiptModal").then(m => m.ReceiptModal))
const PaymentHistoryModal = dynamic(() => import("./PaymentHistoryModal").then(m => m.PaymentHistoryModal))
const PaymentModal = dynamic(() => import("@/features/treasury/components/PaymentModal").then(m => m.PaymentModal))
const PaymentReferenceModal = dynamic(() => import("@/features/treasury/components/PaymentReferenceModal").then(m => m.PaymentReferenceModal))
const NoteCheckoutWizard = dynamic(() => import("@/features/billing/components/NoteCheckoutWizard").then(m => m.NoteCheckoutWizard))
const DocumentListModal = dynamic(() => import("./DocumentListModal").then(m => m.DocumentListModal))
import { LazyDrawer } from "@/features/_shared/transaction-drawer"
const NoteLogisticsModal = dynamic(() => import("./NoteLogisticsModal").then(m => m.NoteLogisticsModal))
const WorkOrderWizard = dynamic(() => import("@/features/production").then(m => m.WorkOrderWizard))
import {
    useAnnulInvoice,
    useDeleteInvoice,
    useCreateInvoiceFromOrder,
    useConfirmInvoice,
    useRegisterPaymentMovement,
} from "../hooks/useOrdersMutations"

import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { Order, OrderLine } from "../types"

interface ActionCategoryProps {
    category: CategoryType
    order: Order
    userPermissions: string[]
    onActionSuccess?: () => void
    layout?: 'list' | 'grid' | 'flex'
    compact?: boolean
    ghost?: boolean
    showBadge?: boolean
    posSessionId?: number | null
    headless?: boolean
}

export const ActionCategory = forwardRef(({
    category,
    order,
    userPermissions,
    onActionSuccess,
    layout = 'list',
    compact = false,
    ghost = false,
    showBadge = true,
    posSessionId = null,
    headless = false
}: ActionCategoryProps, ref) => {
    const [activeModal, setActiveModal] = useState<string | null>(null)
    const [viewConfig, setViewConfig] = useState<{ type: string, id: number | string } | null>(null)

    const openTransaction = (type: string, id: number | string) => {
        setViewConfig({ type, id })
        setActiveModal('transaction-view')
    }

    const closeTransaction = () => {
        setActiveModal(null)
        setViewConfig(null)
    }
    const [isProcessing, setIsProcessing] = useState(false)
    const [hasNotifiedOpen, setHasNotifiedOpen] = useState(false)
    const [confirmModal, setConfirmModal] = useState<{
        open: boolean
        title: string
        description: React.ReactNode
        onConfirm: () => Promise<void> | void
        variant?: 'destructive' | 'warning'
        confirmText?: string
    }>({
        open: false,
        title: "",
        description: null,
        onConfirm: () => { }
    })

    const { setHubTemporarilyHidden, triggerAction } = useHubPanel()

    // Notify parent about modal state changes without clobbering other instances
    useEffect(() => {
        const isAnyModalActive = activeModal !== null || confirmModal.open;
        if (isAnyModalActive) {
            console.log(`[ActionEngine] Hub should hide now. activeModal: ${activeModal}, confirmOpen: ${confirmModal.open}`);
            setHubTemporarilyHidden(true)
            return () => {
                console.log(`[ActionEngine] Hub should restore now.`);
                setHubTemporarilyHidden(false)
            }
        }
    }, [activeModal, confirmModal.open, setHubTemporarilyHidden])
    const [tempInvoiceId, setTempInvoiceId] = useState<number | null>(null)

    useImperativeHandle(ref, () => ({
        handleActionClick
    }))

    const annulInvoice = useAnnulInvoice()
    const deleteInvoice = useDeleteInvoice()
    const createInvoiceFromOrder = useCreateInvoiceFromOrder()
    const confirmInvoice = useConfirmInvoice()
    const registerPaymentMovement = useRegisterPaymentMovement()

    // Determine order type helper - supporting both Order and Note models
    const isSale = !!order?.customer_name || !!order?.customer || !!order?.sale_order
    const isPurchase = !!order?.supplier_name || !!order?.supplier || !!order?.purchase_order

    const resolvedInvoices = (order?.dte_type ? [order] : (order?.related_documents?.invoices || order?.invoices)) || []

    const handleActionClick = (actionId: string) => {
        if (!order) {
            console.error(`[ActionEngine] ERROR: No order context available for action: ${actionId}`);
            toast.error("Error: Los datos del pedido no han cargado. Reintente en un momento.");
            return;
        }

        const action = category.actions.find(a => a.id === actionId)
        if (action?.onClick) {
            action.onClick(order)
            return
        }

        // PERF-09 & HUB-05: Delegation to Global Engine
        // If this is a UI instance (not the headless engine), delegate to the stable global engine.
        if (!headless) {
            console.log(`[ActionEngine] Delegating action ${actionId} to global engine`);
            triggerAction(actionId);
            return;
        }

        switch (actionId) {
            case 'complete-folio':
            case 'register-delivery':
            case 'register-reception':
            case 'confirm-service-delivery':
            case 'payment-history':
            case 'register-payment':
            case 'register-payment-ref':
            case 'create-credit-note':
            case 'create-debit-note':
            case 'create-work-order':
            case 'view-work-orders':
            case 'register-merchandise-return':
            case 'register-payment-return':
                console.log(`[ActionEngine] Setting activeModal to: ${actionId}`);
                setActiveModal(actionId)
                break
            case 'view-documents':
            case 'view-receptions':
            case 'view-deliveries':
                const docs = actionId === 'view-documents'
                    ? resolvedInvoices
                    : (isSale ? (order?.related_documents?.deliveries || []) : (order?.related_documents?.receipts || []))

                if (docs.length === 0) {
                    toast.error("No se han encontrado documentos.")
                    return
                }

                const targetDoc = docs[0] as any
                const viewType = targetDoc.docType || (actionId === 'view-documents' ? 'invoice' : (isSale ? 'sale_delivery' : 'inventory'))
                const viewId = actionId === 'view-documents' ? targetDoc.id : (targetDoc.id || targetDoc.stock_move_id)

                if (!viewId) {
                    toast.error("Error al identificar el documento.")
                    return
                }

                console.log(`[ActionEngine] Opening transaction view for:`, { viewType, viewId });
                openTransaction(viewType, viewId)
                break
            case 'regenerate-document':
                handleRegenerateDocument()
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
        const invoices = resolvedInvoices
        const invoice = invoices.find((inv: any) => inv.number !== 'Draft' && inv.status !== 'CANCELLED')

        if (!invoice) {
            toast.error("No se encontró un documento válido para anular")
            return
        }

        setIsProcessing(true)
        try {
            await annulInvoice.mutateAsync({ id: Number(invoice.id), force })
            onActionSuccess?.()
        } catch (error: unknown) {
            console.error("Error annulling document:", error)
            const errorMessage = getErrorMessage(error) || "Error al anular documento"

            if (errorMessage.includes("pagos asociados") && !force) {
                setConfirmModal({
                    open: true,
                    title: "Anular Documento con Pagos",
                    variant: "warning",
                    confirmText: "Anular Todo",
                    onConfirm: () => handleAnnulDocument(true),
                    description: "El documento tiene pagos asociados. ¿Deseas anular el documento y todos sus pagos?"
                })
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
            const result = await createInvoiceFromOrder.mutateAsync({
                order_id: order?.id,
                order_type: isSale ? 'sale' : 'purchase',
                dte_type: 'FACTURA_ELECTRONICA',
                payment_method: 'CREDIT'
            })

            setTempInvoiceId((result as { id: number }).id)
            setActiveModal('complete-folio')
            onActionSuccess?.()
        } catch (error: unknown) {
            console.error("Error regenerating document:", error)
            showApiError(error, "Error al re-emitir documento")
        } finally {
            setIsProcessing(false)
        }
    }

    const handleDeleteDraft = async () => {
        const invoices = resolvedInvoices
        const draftInvoice = invoices.find((inv: any) => inv.status === 'DRAFT' || inv.number === 'Draft')

        if (!draftInvoice) {
            toast.error("No se encontró un borrador para eliminar")
            return
        }

        setConfirmModal({
            open: true,
            title: "Eliminar Borrador",
            variant: "destructive",
            confirmText: "Eliminar",
            onConfirm: async () => {
                setIsProcessing(true)
                try {
                    await deleteInvoice.mutateAsync(Number(draftInvoice.id))
                    setConfirmModal(prev => ({ ...prev, open: false }))
                    onActionSuccess?.()
                } catch (error: unknown) {
                    console.error("Error deleting draft:", error)
                    toast.error("No se pudo eliminar el borrador")
                } finally {
                    setIsProcessing(false)
                }
            },
            description: "¿Estás seguro de que deseas eliminar este borrador? Esta acción no se puede deshacer."
        })
    }

    const handlePaymentConfirm = async (data: Record<string, unknown>) => {
        setIsProcessing(true)
        try {
            const isInvoice = !!order?.dte_type
            const installments = data.installments as number | undefined
            const isCardPurchase = data.paymentMethod === 'CREDIT_CARD' && installments && installments > 1

            if (isCardPurchase) {
                // Call card-purchase endpoint for credit card installments
                const { treasuryApi } = await import("@/features/treasury/api/treasuryApi")
                const fromAccountId = parseInt(data.treasury_account_id as string)
                const partnerId = (order?.customer || order?.supplier)?.id || (isSale ? order?.customer_id : order?.supplier_id)
                
                await treasuryApi.createCardPurchase({
                    amount: data.amount as string | number,
                    from_account: fromAccountId,
                    installments: installments,
                    monthly_rate: (data.monthlyRate as number) || 0,
                    partner: partnerId || undefined,
                    client_reference: `ORDER-${order?.id}`,
                })
            } else {
                // Standard payment flow
                const payload = {
                    ...data,
                    payment_type: isSale ?
                        (isInvoice && order.dte_type === 'NOTA_CREDITO' ? 'OUTBOUND' : 'INBOUND') :
                        (isInvoice && order.dte_type === 'NOTA_CREDITO' ? 'INBOUND' : 'OUTBOUND'),
                    partner: (order?.customer || order?.supplier)?.id || (isSale ? order?.customer_id : order?.supplier_id),
                    ...(posSessionId ? { pos_session_id: posSessionId } : {})
                }

                if (isInvoice) {
                    (payload as Record<string, unknown>).invoice = order.id
                } else {
                    (payload as Record<string, unknown>)[isSale ? 'sale_order' : 'purchase_order'] = order?.id
                }

                await registerPaymentMovement.mutateAsync(payload)
            }

            closeModal()
            onActionSuccess?.()
        } catch (error: unknown) {
            console.error("Error registering payment:", error)
            showApiError(error, "Error al registrar pago")
        } finally {
            setIsProcessing(false)
        }
    }

    const filteredActions = category?.actions.filter(action => {
        if (action.requiredPermissions && !action.requiredPermissions.some(p => userPermissions.includes(p))) {
            return false
        }
        // If no order, we can't check availability for order-based actions
        if (action.checkAvailability) {
            if (!order) return false
            if (!action.checkAvailability(order)) return false
        }
        return true
    }) || []

    const categoryBadgeCount = filteredActions.reduce((acc, action) => acc + (getActionBadgeCount(action, order) || 0), 0)
    
    // PERF-09: Headless Persistence
    // The engine must remain mounted to handle modals even if no actions are visible or if it's headless.
    if (!headless && filteredActions.length === 0 && !activeModal) return null

    return (
        <>
            {!headless && (
                <div className={cn(
                    layout === 'grid' ? "space-y-0" : (ghost || layout === 'flex' ? "space-y-2" : "p-4 space-y-4 rounded-lg border bg-card/50 shadow-sm")
                )}>
                    {layout === 'list' && (category.icon || category.label) && (
                        <div className="flex items-center gap-2 pb-2 border-b border-border/50">
                            {category.icon && (
                                <div className="p-1.5 rounded bg-primary/10 text-primary border border-primary/10">
                                    <category.icon className="h-4 w-4" />
                                </div>
                            )}
                            {category.label && <h3 className="font-heading font-extrabold uppercase text-xs tracking-wider">{category.label}</h3>}
                            {categoryBadgeCount > 0 && (
                                <Chip.Count value={categoryBadgeCount} size="sm" intent="neutral" className="ml-auto rounded" />
                            )}
                        </div>
                    )}

                    <div className={cn(
                        layout === 'grid' ? (compact ? "grid grid-cols-1 gap-1" : "grid grid-cols-1 sm:grid-cols-2 gap-4") :
                            layout === 'flex' ? "flex flex-wrap items-center justify-center gap-1.5" :
                                "space-y-1.5"
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
                </div>
            )}

             {/* Modals with Suspense to prevent layout unmount on first load */}
             <SkeletonShell isLoading={!!activeModal} ariaLabel="Cargando modal de acción">
                 <Suspense fallback={<div />}>
                     {activeModal === 'complete-folio' && (
                     <DocumentCompletionModal
                         open={true}
                         onOpenChange={closeModal}
                         invoiceId={(tempInvoiceId || resolvedInvoices?.find((inv: any) => inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number)?.id) as number || 0}
                         invoiceType={(tempInvoiceId ? "FACTURA_ELECTRONICA" : (resolvedInvoices?.find((inv: any) => inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number) as any)?.dte_type as string) || "FACTURA_ELECTRONICA"}
                         contactId={(((order?.customer || order?.supplier) as Record<string, unknown>)?.id as number || (isSale ? (order as any).customer_id : (order as any).supplier_id)) as number || 0}
                         isPurchase={isPurchase}
                          onComplete={async (invoiceId, formData) => {
                              if (!invoiceId) {
                                  toast.error("Error: No se pudo identificar el borrador de la factura.")
                                  throw new Error("Missing invoice ID")
                              }
                              await confirmInvoice.mutateAsync({ id: invoiceId, formData: formData as unknown as Record<string, unknown> })
                          }}
                         onSuccess={() => { closeModal(); onActionSuccess?.() }}
                     />
                 )}

            {(activeModal === 'register-delivery' || activeModal === 'register-reception' || activeModal === 'confirm-service-delivery' || activeModal === 'register-merchandise-return') && (
                order?.dte_type ? (
                    <NoteLogisticsModal
                        open={true}
                        onOpenChange={closeModal}
                        invoice={order}
                        onSuccess={() => { closeModal(); onActionSuccess?.() }}
                    />
                ) : (
                    isSale ? (
                        <DeliveryDrawer
                            open={true}
                            onOpenChange={closeModal}
                            orderId={order?.id}
                            onSuccess={() => { closeModal(); onActionSuccess?.() }}
                            filterType={activeModal === 'confirm-service-delivery' ? 'SERVICE' : 'ALL'}
                        />
                    ) : (
                        <ReceiptModal
                            open={true}
                            onOpenChange={closeModal}
                            orderId={order?.id}
                            onSuccess={() => { closeModal(); onActionSuccess?.() }}
                            filterType={activeModal === 'confirm-service-delivery' ? 'SERVICE' : (activeModal === 'register-reception' ? 'PRODUCT' : 'ALL')}
                        />
                    )
                )
            )}

            {activeModal === 'payment-history' && (
                <PaymentHistoryModal
                    open={true}
                    onOpenChange={closeModal}
                    order={order as any}
                />
            )}

            {(activeModal === 'register-payment' || activeModal === 'register-payment-return') && (
                <PaymentModal
                    open={true}
                    onOpenChange={closeModal}
                    total={Number(order?.total || 0)}
                    pendingAmount={Number(order?.pending_amount ?? order?.total ?? 0)}
                    onConfirm={handlePaymentConfirm}
                    isPurchase={isPurchase}
                    title={activeModal === 'register-payment-return' ? (isSale ? "Registrar Reembolso a Cliente" : "Registrar Reembolso de Proveedor") : undefined}
                    posSessionId={posSessionId}
                    customerCreditBalance={(order?.customer as any)?.credit_balance || (order?.customer_name as any)?.credit_balance || 0}
                    allowCreditBalanceAccumulation={order?.dte_type === 'NOTA_CREDITO'}
                />
            )}

            {activeModal === 'register-payment-ref' && (
                <PaymentReferenceModal
                    open={true}
                    onOpenChange={closeModal}
                    payments={(order?.related_documents?.payments || order?.serialized_payments || []) as any}
                    onSuccess={() => { closeModal(); onActionSuccess?.() }}
                />
            )}

            {(activeModal === 'create-credit-note' || activeModal === 'create-debit-note') && (
                <NoteCheckoutWizard
                    open={true}
                    onOpenChange={closeModal}
                    orderId={order?.id}
                    invoiceId={(resolvedInvoices?.find((inv: any) => inv.status !== 'CANCELLED' && !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type as string))?.id as number) || 0}
                    initialType={activeModal === 'create-debit-note' ? 'NOTA_DEBITO' : 'NOTA_CREDITO'}
                    onSuccess={() => { closeModal(); onActionSuccess?.() }}
                />
            )}

            {activeModal === 'transaction-view' && viewConfig && (
                <LazyDrawer
                    type={viewConfig.type}
                    id={viewConfig.id}
                    open={true}
                    onOpenChange={(open) => !open && closeTransaction()}
                />
            )}
            {activeModal === 'view-work-orders' && (
                <DocumentListModal
                    open={true}
                    onOpenChange={closeModal}
                    type="work_orders"
                    data={(order?.work_orders || []) as any}
                    onItemClick={(type, id) => {
                        openTransaction(type, id)
                    }}
                />
            )}

            {activeModal === 'create-work-order' && (
                <WorkOrderWizard
                    open={true}
                    onOpenChange={closeModal}
                    mode={{
                        kind: 'create',
                        defaultOtType: 'LINKED',
                        initialData: {
                            sale_order: order?.id?.toString(),
                            sale_line: (order.lines || order.items || []).find((l: OrderLine) =>
                                l.product_type === 'MANUFACTURABLE' &&
                                l.requires_advanced_manufacturing &&
                                !((l as any).work_order_summary)
                            )?.id?.toString()
                        }
                    }}
                    onSuccess={() => {
                        closeModal()
                        onActionSuccess?.()
                    }}
                />
             )}
             {activeModal === 'transaction-view' && viewConfig && (
                 <LazyDrawer
                     type={viewConfig.type}
                     id={viewConfig.id}
                     open={true}
                     onOpenChange={(open) => !open && closeTransaction()}
                 />
             )}
             <ActionConfirmModal
                 open={confirmModal.open}
                 onOpenChange={(open) => setConfirmModal(prev => ({ ...prev, open }))}
                 title={confirmModal.title}
                 description={confirmModal.description}
                 onConfirm={confirmModal.onConfirm}
                 variant={confirmModal.variant}
                 confirmText={confirmModal.confirmText}
             />
             </Suspense>
         </SkeletonShell>
        </>
    )
})

ActionCategory.displayName = "ActionCategory"
