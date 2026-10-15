"use client"

import { useState, type ReactNode } from "react"
import { Ban, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { getErrorMessage, showApiError } from "@/lib/errors"
import { ActionConfirmModal, type DocumentActionItem } from "@/components/shared"
import type { DocumentLink } from "@/features/documents"
import { AnnulPaymentModal } from "../components/AnnulPaymentModal"
import {
    useAnnulInvoice,
    useAnnulLogistics,
    useAnnulWorkOrder,
    useCancelInvoice,
    useCancelPayment,
} from "./useOrdersMutations"
import type { Order, WorkOrder } from "../types"

interface ConfirmState {
    title: string
    description: ReactNode
    onConfirm: (reason?: string) => Promise<void>
    variant: "destructive" | "warning"
    confirmText: string
    requireReason?: boolean
}

interface UseOrderRelatedActionsOptions {
    order: Order | null | undefined
    isSale: boolean
    permissions: string[]
    onSuccess?: () => void
}

/** Etapas de OT anulables (antes de impresión). Misma regla que ProductionPhase del Hub. */
const ANNULLABLE_OT_STAGES = ['MATERIAL_ASSIGNMENT', 'MATERIAL_APPROVAL', 'PREPRESS']

const LOGISTICS_DOC_TYPES: Record<string, { docType: string; label: string }> = {
    'sales.saledelivery': { docType: 'sale_delivery', label: 'Despacho' },
    'purchasing.purchasereceipt': { docType: 'purchase_receipt', label: 'Recepción' },
    'sales.salereturn': { docType: 'sale_return', label: 'Devolución' },
    'purchasing.purchasereturn': { docType: 'purchase_return', label: 'Devolución' },
}

/**
 * Acciones sobre los documentos relacionados de una OV/OC en el tab Relaciones (ADR-0083):
 * cancelar/anular factura, pago, despacho/recepción, devolución y OT. Mismas reglas y
 * permisos que las fases del Order Hub, que este hook reemplaza.
 */
export function useOrderRelatedActions({ order, isSale, permissions, onSuccess }: UseOrderRelatedActionsOptions) {
    const { annulInvoice } = useAnnulInvoice()
    const { cancelInvoice } = useCancelInvoice()
    const { cancelPayment } = useCancelPayment()
    const { annulLogistics } = useAnnulLogistics()
    const { annulWorkOrder } = useAnnulWorkOrder()

    const [confirm, setConfirm] = useState<ConfirmState | null>(null)
    const [paymentToAnnul, setPaymentToAnnul] = useState<{ id: number; amount: number } | null>(null)

    const invoices = order?.related_documents?.invoices ?? []
    const hasDraftInvoice = invoices.some((inv) => inv.status === 'DRAFT')
    const can = (perm: string) => permissions.includes(perm)

    const close = () => setConfirm(null)
    const confirmThen = (state: Omit<ConfirmState, 'onConfirm'>, run: (reason?: string) => Promise<unknown>, errorLabel: string) => {
        setConfirm({
            ...state,
            onConfirm: async (reason?: string) => {
                try {
                    await run(reason)
                    close()
                    onSuccess?.()
                } catch (error: unknown) {
                    showApiError(error, errorLabel)
                    throw error
                }
            },
        })
    }

    const annulInvoiceFlow = (id: number) => {
        const execute = async (force: boolean, reason?: string): Promise<void> => {
            try {
                await annulInvoice({ id, force, reason })
                close()
                onSuccess?.()
            } catch (error: unknown) {
                const message = getErrorMessage(error) || "Error al anular documento"
                if (message.includes("pagos") && !force) {
                    // Pasa a la variante "anular con pagos"; el throw mantiene el modal abierto.
                    setConfirm({
                        title: "Anular Documento con Pagos",
                        variant: "warning",
                        confirmText: "Anular Todo",
                        requireReason: true,
                        onConfirm: (r?: string) => execute(true, r),
                        description: "El documento tiene pagos asociados. ¿Deseas anular el documento y todos sus pagos vinculados? Esta acción es irreversible.",
                    })
                } else {
                    toast.error(message)
                }
                throw error
            }
        }
        setConfirm({
            title: "Anular Documento",
            variant: "warning",
            confirmText: "Anular",
            requireReason: true,
            onConfirm: (reason?: string) => execute(false, reason),
            description: "Se revertirá el asiento contable del documento. Esta acción es irreversible.",
        })
    }

    const rowActions = (link: DocumentLink): DocumentActionItem[] => {
        const { label, id, status, accessible } = link.target
        if (!accessible || status === 'CANCELLED') return []

        if (label === 'billing.invoice') {
            const invoice = invoices.find((inv) => Number(inv.id) === id)
            if (!invoice || !can('billing.delete_invoice')) return []
            if (invoice.status === 'DRAFT') {
                return [{
                    id: 'cancel-draft-invoice', label: 'Cancelar borrador', icon: Trash2, destructive: true,
                    onClick: () => confirmThen(
                        { title: "Cancelar Borrador", variant: "destructive", confirmText: "Cancelar Borrador", description: "¿Estás seguro de que deseas cancelar este borrador de factura?" },
                        (reason) => cancelInvoice({ id, reason }),
                        "No se pudo cancelar el borrador",
                    ),
                }]
            }
            if (!invoice.number || invoice.number === 'Draft') {
                return [{ id: 'annul-invoice', label: 'Anular documento', icon: Ban, destructive: true, onClick: () => annulInvoiceFlow(id) }]
            }
            return []
        }

        if (label === 'treasury.treasurymovement') {
            if (!can('treasury.delete_treasurymovement')) return []
            if (status === 'POSTED') {
                return [{
                    id: 'annul-payment', label: 'Anular pago', icon: Ban, destructive: true,
                    onClick: () => setPaymentToAnnul({ id, amount: Number(link.amount ?? 0) }),
                }]
            }
            return [{
                id: 'cancel-payment', label: 'Cancelar pago', icon: Trash2, destructive: true,
                onClick: () => confirmThen(
                    { title: "Cancelar Pago", variant: "destructive", confirmText: "Cancelar", description: "¿Está seguro de que desea cancelar este pago?" },
                    (reason) => cancelPayment({ id, reason }),
                    "Error al cancelar el pago",
                ),
            }]
        }

        const logistics = LOGISTICS_DOC_TYPES[label]
        if (logistics) {
            const isReturn = logistics.docType.endsWith('_return')
            const perm = isSale ? 'sales.delete_saledelivery' : 'purchasing.delete_purchasereceipt'
            // Despacho/recepción: solo mientras la factura siga en borrador (regla del Hub)
            if (!can(perm) || (!isReturn && !hasDraftInvoice)) return []
            return [{
                id: `annul-${logistics.docType}`, label: `Anular ${logistics.label.toLowerCase()}`, icon: Ban, destructive: true,
                onClick: () => confirmThen(
                    {
                        title: `Anular ${logistics.label}`, variant: "destructive", confirmText: `Anular ${logistics.label}`, requireReason: true,
                        description: `Esta acción reverterá los movimientos de inventario asociados. ¿Está seguro de anular este ${logistics.label.toLowerCase()}?`,
                    },
                    (reason) => annulLogistics({ id, docType: logistics.docType, reason }),
                    `Error al anular ${logistics.label}`,
                ),
            }]
        }

        if (label === 'production.workorder') {
            const workOrder = (order?.work_orders ?? []).find((ot: WorkOrder) => Number(ot.id) === id)
            const annullable = can('production.delete_workorder') && hasDraftInvoice
                && ANNULLABLE_OT_STAGES.includes(workOrder?.current_stage ?? '')
            if (!annullable) return []
            return [{
                id: 'annul-work-order', label: 'Anular OT', icon: Ban, destructive: true,
                onClick: () => confirmThen(
                    {
                        title: "Anular Orden de Trabajo", variant: "destructive", confirmText: "Anular OT", requireReason: true,
                        description: "Esta acción reverterá los consumos de materiales y liberará las reservas. ¿Está seguro?",
                    },
                    (reason) => annulWorkOrder({ id, reason }),
                    "Error al anular OT",
                ),
            }]
        }

        return []
    }

    const host = (
        <>
            <ActionConfirmModal
                open={!!confirm}
                onOpenChange={(open) => { if (!open) close() }}
                title={confirm?.title ?? ""}
                description={confirm?.description}
                onConfirm={confirm?.onConfirm ?? (() => undefined)}
                variant={confirm?.variant}
                confirmText={confirm?.confirmText}
                requireReason={confirm?.requireReason}
                reasonLabel="Motivo de la anulación"
            />
            {paymentToAnnul && (
                <AnnulPaymentModal
                    key={paymentToAnnul.id}
                    open
                    onOpenChange={(open) => { if (!open) setPaymentToAnnul(null) }}
                    paymentId={paymentToAnnul.id}
                    paymentAmount={paymentToAnnul.amount}
                    isSale={isSale}
                    onSuccess={onSuccess}
                />
            )}
        </>
    )

    return { rowActions, host }
}
