"use client"

import { useState, type ReactNode } from "react"
import { Ban, Trash2 } from "lucide-react"
import { showApiError } from "@/lib/errors"
import { getDomainConceptTitle, getDomainConceptCode } from "@/lib/entity-registry"
import { ActionConfirmModal, type DocumentActionItem } from "@/components/shared"
import type { DocumentLink } from "@/features/documents"
import { AnnulPaymentModal } from "../components/AnnulPaymentModal"
import {
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
 * cancelar borrador de factura, cancelar/anular pago, anular despacho/recepción, devolución y
 * OT. Mismas reglas y permisos que las fases del Order Hub, que este hook reemplaza.
 */
export function useOrderRelatedActions({ order, isSale, permissions, onSuccess }: UseOrderRelatedActionsOptions) {
    const { cancelInvoice } = useCancelInvoice()
    const { cancelPayment } = useCancelPayment()
    const { annulLogistics } = useAnnulLogistics()
    const { annulWorkOrder } = useAnnulWorkOrder()

    const [confirm, setConfirm] = useState<ConfirmState | null>(null)
    const [paymentToAnnul, setPaymentToAnnul] = useState<{ id: number; amount: number } | null>(null)

    const invoices = order?.invoices ?? []
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

    /**
     * Acciones de documento sobre una factura (ADR-0084): un borrador (folio pendiente) se
     * cancela; una emitida no se anula, se corrige con NC/ND (acciones del registro).
     */
    const invoiceActions = (invoice: { id: number; status?: string }): DocumentActionItem[] => {
        if (!can('billing.delete_invoice') || invoice.status !== 'DRAFT') return []
        return [{
            id: 'cancel-draft-invoice', label: 'Cancelar borrador', icon: Trash2, destructive: true,
            onClick: () => confirmThen(
                { title: "Cancelar Borrador", variant: "destructive", confirmText: "Cancelar Borrador", description: "¿Estás seguro de que deseas cancelar este borrador de factura?" },
                (reason) => cancelInvoice({ id: invoice.id, reason }),
                "No se pudo cancelar el borrador",
            ),
        }]
    }

    const rowActions = (link: DocumentLink): DocumentActionItem[] => {
        const { label, id, status, accessible } = link.target
        if (!accessible || status === 'CANCELLED') return []

        if (label === 'billing.invoice') {
            const invoice = invoices.find((inv) => Number(inv.id) === id)
            return invoice ? invoiceActions({ id, status: invoice.status }) : []
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
                        title: `Anular ${getDomainConceptTitle('ot')}`, variant: "destructive", confirmText: `Anular ${getDomainConceptCode('ot')}`, requireReason: true,
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

    return { rowActions, invoiceActions, host }
}
