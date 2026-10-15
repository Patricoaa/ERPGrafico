"use client"

import { Suspense, useState, type ReactNode } from "react"
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { showApiError } from "@/lib/errors"
import { SkeletonShell } from "@/components/shared"
import {
    useConfirmInvoice,
    useCreateInvoiceFromOrder,
    useRegisterPaymentMovement,
    useRegisterPaymentReturn,
} from "./useOrdersMutations"
import type { Order, OrderLine } from "../types"

// Modales lazy (PERF-01): solo se cargan al ejecutar su acción.
const DocumentCompletionModal = dynamic(() => import("@/components/shared/DocumentCompletionModal").then(m => m.DocumentCompletionModal))
const DeliveryDrawer = dynamic(() => import("@/features/sales").then(m => m.DeliveryDrawer))
const ReceiptModal = dynamic(() => import("@/features/purchasing/components/ReceiptModal").then(m => m.ReceiptModal))
const PaymentHistoryModal = dynamic(() => import("../components/PaymentHistoryModal").then(m => m.PaymentHistoryModal))
const PaymentModal = dynamic(() => import("@/features/treasury/components/PaymentModal").then(m => m.PaymentModal))
const UnifiedNoteWizard = dynamic(() => import("@/features/notes").then(m => ({ default: m.UnifiedNoteWizard })))
const NoteLogisticsModal = dynamic(() => import("../components/NoteLogisticsModal").then(m => m.NoteLogisticsModal))
const WorkOrderWizard = dynamic(() => import("@/features/production").then(m => m.WorkOrderWizard))
const InvoiceFromLinesModal = dynamic(() => import("@/features/billing").then(m => m.InvoiceFromLinesModal))

/** Acciones que abren un modal propio del motor. */
export const ENGINE_MODAL_ACTIONS = [
    "complete-folio",
    "register-delivery",
    "register-reception",
    "confirm-service-delivery",
    "payment-history",
    "register-payment",
    "create-credit-note",
    "create-debit-note",
    "create-work-order",
    "register-merchandise-return",
    "register-payment-return",
    "invoice-by-lines",
] as const

/** Acciones que el motor ejecuta sin modal propio. */
export const ENGINE_DIRECT_ACTIONS = ["regenerate-document"] as const

export type EngineActionId = typeof ENGINE_MODAL_ACTIONS[number] | typeof ENGINE_DIRECT_ACTIONS[number]

export function isEngineAction(actionId: string): actionId is EngineActionId {
    return (ENGINE_MODAL_ACTIONS as readonly string[]).includes(actionId)
        || (ENGINE_DIRECT_ACTIONS as readonly string[]).includes(actionId)
}

interface UseOrderActionEngineOptions {
    /** OV/OC, o factura/nota (`dte_type`) en modo nota. */
    order: Order | null | undefined
    posSessionId?: number | null
    onActionSuccess?: () => void
}

export interface OrderActionEngine {
    /** Ejecuta una acción del registro (sales/purchasing actions). */
    run: (actionId: string) => void
    /** Modales del motor; montar una vez dentro de la ficha. */
    host: ReactNode
    isModalOpen: boolean
}

/**
 * Motor de acciones de documentos comerciales (OV, OC, factura/nota) — ADR-0083.
 * Extraído de `ActionCategory` del Order Hub: misma lógica y mismos modales, sin motor global
 * ni `ref`. Lo usan la ficha documental y, hasta su retiro, el Hub.
 */
export function useOrderActionEngine({ order, posSessionId = null, onActionSuccess }: UseOrderActionEngineOptions): OrderActionEngine {
    const [activeModal, setActiveModal] = useState<EngineActionId | null>(null)
    const [tempInvoiceId, setTempInvoiceId] = useState<number | null>(null)

    const { createInvoiceFromOrder } = useCreateInvoiceFromOrder()
    const { confirmInvoice } = useConfirmInvoice()
    const { registerPaymentMovement } = useRegisterPaymentMovement()
    const { registerPaymentReturn } = useRegisterPaymentReturn()

    // Tipo de documento: soporta OV/OC y notas (que referencian su orden)
    const isSale = !!order?.customer_name || !!order?.customer || !!order?.sale_order
    const isPurchase = !!order?.supplier_name || !!order?.supplier || !!order?.purchase_order
    const resolvedInvoices = (order?.dte_type ? [order] : (order?.related_documents?.invoices || order?.invoices)) || []
    const partnerId = order
        ? (((order.customer || order.supplier) as { id?: number } | undefined)?.id ?? (isSale ? order.customer_id : order.supplier_id))
        : undefined

    const closeModal = () => setActiveModal(null)
    const done = () => { closeModal(); onActionSuccess?.() }

    const regenerateDocument = async () => {
        if (!order) return
        try {
            const result = (await createInvoiceFromOrder({
                order_id: order.id,
                order_type: isSale ? 'sale' : 'purchase',
                dte_type: 'FACTURA_ELECTRONICA',
                payment_method: 'CREDIT',
            })) as { id: number }
            setTempInvoiceId(result.id)
            setActiveModal('complete-folio')
            onActionSuccess?.()
        } catch (error: unknown) {
            showApiError(error, "Error al re-emitir documento")
        }
    }

    const run = (actionId: string) => {
        if (!order) {
            toast.error("Los datos del documento no han cargado. Reintente en un momento.")
            return
        }
        if (actionId === 'regenerate-document') {
            void regenerateDocument()
            return
        }
        if (isEngineAction(actionId)) {
            setActiveModal(actionId)
            return
        }
        console.warn(`[OrderActionEngine] Acción sin handler: ${actionId}`)
    }

    const handlePaymentConfirm = async (data: Record<string, unknown>) => {
        if (!order) return
        const idempotencyKey = newIdempotencyKey()
        try {
            // ── Devolución (register-payment-return) ──────────────────────
            if (activeModal === 'register-payment-return') {
                const isInvoice = !!order.dte_type
                if (isInvoice && order.dte_type === 'NOTA_CREDITO') {
                    // NC: nuevo pago de reembolso
                    await registerPaymentMovement({
                        data: {
                            ...data,
                            payment_type: isSale ? 'OUTBOUND' : 'INBOUND',
                            partner: partnerId,
                            invoice: order.id,
                            ...(posSessionId ? { pos_session_id: posSessionId } : {}),
                        },
                        idempotencyKey,
                    })
                } else {
                    // Factura en borrador con pagos contabilizados: se devuelve el primero
                    const payments = order.related_documents?.payments || []
                    const firstPosted = payments.find((p) => (p.journal_entry as Record<string, unknown> | undefined)?.state === 'POSTED')
                    if (!firstPosted?.id) {
                        toast.error("No se encontró un pago contabilizado para devolver.")
                        return
                    }
                    await registerPaymentReturn({
                        paymentId: Number(firstPosted.id),
                        amount: data.amount as number,
                        treasuryAccountId: data.treasury_account_id ? Number(data.treasury_account_id) : null,
                    })
                }
                done()
                return
            }

            // ── Pago estándar ─────────────────────────────────────────────
            const isInvoice = !!order.dte_type
            const installments = data.installments as number | undefined
            const isCardPurchase = data.paymentMethod === 'CREDIT_CARD' && installments && installments > 1

            if (isCardPurchase) {
                const { treasuryApi } = await import("@/features/treasury/api/treasuryApi")
                await treasuryApi.createCardPurchase({
                    amount: data.amount as string | number,
                    from_account: parseInt(data.treasury_account_id as string),
                    installments,
                    partner: partnerId || undefined,
                    invoice: isInvoice ? order.id : undefined,
                    sale_order: !isInvoice && isSale ? order.id : undefined,
                    purchase_order: !isInvoice && !isSale ? order.id : undefined,
                    client_reference: `ORDER-${order.id}`,
                })
            } else {
                const isCreditNote = isInvoice && order.dte_type === 'NOTA_CREDITO'
                const payload: Record<string, unknown> = {
                    ...data,
                    payment_type: isSale ? (isCreditNote ? 'OUTBOUND' : 'INBOUND') : (isCreditNote ? 'INBOUND' : 'OUTBOUND'),
                    partner: partnerId,
                    ...(posSessionId ? { pos_session_id: posSessionId } : {}),
                }
                if (isInvoice) payload.invoice = order.id
                else payload[isSale ? 'sale_order' : 'purchase_order'] = order.id
                await registerPaymentMovement({ data: payload, idempotencyKey })
            }
            done()
        } catch (error: unknown) {
            showApiError(error, "Error al registrar pago")
        }
    }

    const draftInvoice = resolvedInvoices.find((inv) => inv.status === 'DRAFT' || inv.number === 'Draft' || !inv.number)
    const noteSourceInvoice = resolvedInvoices.find((inv) => inv.status !== 'CANCELLED' && !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type as string))

    const host = order && activeModal ? (
        <SkeletonShell isLoading ariaLabel="Cargando modal de acción">
            <Suspense fallback={<div />}>
                {activeModal === 'complete-folio' && (
                    <DocumentCompletionModal
                        open
                        onOpenChange={closeModal}
                        invoiceId={(tempInvoiceId || draftInvoice?.id) as number || 0}
                        invoiceType={(tempInvoiceId ? "FACTURA_ELECTRONICA" : draftInvoice?.dte_type as string) || "FACTURA_ELECTRONICA"}
                        contactId={Number(partnerId) || 0}
                        isPurchase={isPurchase}
                        onComplete={async (invoiceId, formData) => {
                            if (!invoiceId) {
                                toast.error("No se pudo identificar el borrador de la factura.")
                                throw new Error("Missing invoice ID")
                            }
                            await confirmInvoice({ id: invoiceId, formData: formData as unknown as Record<string, unknown> })
                        }}
                        onSuccess={done}
                    />
                )}

                {activeModal === 'invoice-by-lines' && (
                    <InvoiceFromLinesModal
                        open
                        onOpenChange={(open) => { if (!open) closeModal() }}
                        side={isSale ? 'sale' : 'purchase'}
                        orderId={Number(order.id)}
                        partnerId={Number(partnerId) || null}
                        onSuccess={done}
                    />
                )}

                {(activeModal === 'register-delivery' || activeModal === 'register-reception' || activeModal === 'confirm-service-delivery' || activeModal === 'register-merchandise-return') && (
                    order.dte_type ? (
                        <NoteLogisticsModal open onOpenChange={closeModal} invoice={order} onSuccess={done} />
                    ) : isSale ? (
                        <DeliveryDrawer
                            open
                            onOpenChange={closeModal}
                            orderId={order.id}
                            onSuccess={done}
                            filterType={activeModal === 'confirm-service-delivery' ? 'SERVICE' : 'ALL'}
                        />
                    ) : (
                        <ReceiptModal
                            open
                            onOpenChange={closeModal}
                            orderId={order.id}
                            onSuccess={done}
                            filterType={activeModal === 'confirm-service-delivery' ? 'SERVICE' : (activeModal === 'register-reception' ? 'PRODUCT' : 'ALL')}
                        />
                    )
                )}

                {activeModal === 'payment-history' && (
                    <PaymentHistoryModal open onOpenChange={closeModal} order={order} />
                )}

                {(activeModal === 'register-payment' || activeModal === 'register-payment-return') && (
                    <PaymentModal
                        open
                        onOpenChange={closeModal}
                        total={Number(order.total || 0)}
                        pendingAmount={Number(order.pending_amount ?? order.total ?? 0)}
                        onConfirm={handlePaymentConfirm}
                        isPurchase={isPurchase}
                        isRefund={activeModal === 'register-payment-return'}
                        title={activeModal === 'register-payment-return' ? (isSale ? "Registrar Reembolso a Cliente" : "Registrar Reembolso de Proveedor") : undefined}
                        posSessionId={posSessionId}
                        customerCreditBalance={((order.customer as { credit_balance?: number } | undefined)?.credit_balance) || 0}
                        allowCreditBalanceAccumulation={order.dte_type === 'NOTA_CREDITO'}
                    />
                )}

                {(activeModal === 'create-credit-note' || activeModal === 'create-debit-note') && (
                    <UnifiedNoteWizard
                        open
                        onOpenChange={closeModal}
                        mode="sales"
                        initialType={activeModal === 'create-debit-note' ? 'NOTA_DEBITO' : 'NOTA_CREDITO'}
                        features={{ logistics: true, manufacturing: true }}
                        referenceLabel={noteSourceInvoice?.number}
                        fetchSource={async () => {
                            const { billingApi } = await import('@/features/billing/api/billingApi')
                            const inv = (await billingApi.getInvoice(Number(noteSourceInvoice?.id) || 0) as unknown) as Record<string, unknown>
                            const invLines = ((inv.lines as Record<string, unknown>[]) || []).map((l) => ({
                                lineId: l.id as number,
                                productId: l.product as number,
                                productName: l.product_name as string,
                                productCode: l.product_code as string | undefined,
                                productType: l.product_type as string | undefined,
                                trackInventory: l.track_inventory as boolean | undefined,
                                hasBom: l.has_bom as boolean | undefined,
                                requiresAdvancedManufacturing: l.requires_advanced_manufacturing as boolean | undefined,
                                mfgAutoFinalize: l.mfg_auto_finalize as boolean | undefined,
                                createsStockMove: (l.track_inventory as boolean) && (l.product_type as string) !== 'MANUFACTURABLE',
                                uomName: l.uom_name as string | undefined,
                                originalQuantity: (l.quantity_delivered as number) || (l.quantity as number),
                                noteQuantity: 0,
                                noteUnitPrice: (l.unit_price as number) || 0,
                                taxAmountPerUnit: ((l.unit_price as number) || 0) * (((l.tax_rate as number) ?? 19) / 100),
                                reason: '',
                            }))
                            return {
                                label: `${inv.dte_type_display as string} ${inv.number as string}`,
                                isExempt: (inv.dte_type as string) === 'FACTURA_EXENTA' || (inv.dte_type as string) === 'BOLETA_EXENTA',
                                originalTotal: inv.total as number,
                                lines: invLines,
                            }
                        }}
                        onSubmit={async (payload) => {
                            const { billingApi } = await import('@/features/billing/api/billingApi')
                            const formData = new FormData()
                            formData.append('original_invoice_id', String(Number(noteSourceInvoice?.id) || 0))
                            formData.append('note_type', payload.noteType)
                            formData.append('selected_items', JSON.stringify(payload.lines.map(l => ({
                                line_id: l.lineId,
                                product_id: l.productId,
                                quantity: l.noteQuantity,
                                unit_price: l.noteUnitPrice,
                                tax_amount: l.taxAmountPerUnit ?? 0,
                                reason: l.reason ?? '',
                                manufacturing_data: l.manufacturingData ?? null,
                            }))))
                            if (payload.logistics) formData.append('logistics_data', JSON.stringify(payload.logistics))
                            const reg = payload.registration
                            formData.append('registration_data', JSON.stringify({ document_number: reg.documentNumber, document_date: reg.documentDate, is_pending: reg.isPending }))
                            if (reg.attachment) formData.append('document_attachment', reg.attachment)
                            if (payload.payment.method) formData.append('payment_data', JSON.stringify(payload.payment))
                            await billingApi.noteWorkflowCheckout(formData)
                        }}
                        onSuccess={done}
                    />
                )}

                {activeModal === 'create-work-order' && (
                    <WorkOrderWizard
                        open
                        onOpenChange={closeModal}
                        mode={{
                            kind: 'create',
                            defaultOtType: 'LINKED',
                            initialData: {
                                sale_order: order.id?.toString(),
                                sale_line: (order.lines || order.items || []).find((l: OrderLine) =>
                                    l.product_type === 'MANUFACTURABLE' &&
                                    l.requires_advanced_manufacturing &&
                                    !l.work_order_summary
                                )?.id?.toString(),
                            },
                        }}
                        onSuccess={done}
                    />
                )}
            </Suspense>
        </SkeletonShell>
    ) : null

    return { run, host, isModalOpen: activeModal !== null }
}

/** UUID v4; `crypto.randomUUID` no existe fuera de contextos seguros (dev server por http). */
function newIdempotencyKey(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
}
