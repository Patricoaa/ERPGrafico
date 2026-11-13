"use client"

import { useMemo, useState } from "react"
import { ChevronRight, Edit, MoreVertical, Ban, Trash2 } from "lucide-react"
import { ActionConfirmModal, DataCell, type ActionMenuItem, type DocumentActionItem } from "@/components/shared"
import { Button } from "@/components/ui/button"
import {
    resolveRegistryActions,
    useInvalidateDocuments,
    type ResolvedDocumentAction,
} from "@/features/documents"
import { saleOrderActions } from "@/features/sales"
import { purchaseOrderActions, PurchaseCheckoutWizard } from "@/features/purchasing"
import { useInvoiceDocument, useOrderDocument } from "../hooks/useCommercialDocument"
import { useCancelOrderFlow } from "../hooks/useCancelOrderFlow"
import { useOrderActionEngine } from "../hooks/useOrderActionEngine"
import { useOrderRelatedActions } from "../hooks/useOrderRelatedActions"
import { INVOICE_ACTIONS, NOTE_ACTIONS, planOrderSheetActions, SHEET_EXCLUDED_ACTIONS } from "../utils/orderSheetActions"
import type { Order } from "../types"

export type DocumentRowKind = "sale-order" | "purchase-order" | "invoice"

export interface DocumentRowActionsProps {
    id: number
    kind: DocumentRowKind
    /** Opens the document sheet; offered as the first menu entry. */
    onOpen?: (id: number) => void
}

/**
 * Row kebab of a document with a hub status (OV, OC, invoices and notes). Offers the same actions
 * as the document sheet (ADR-0083). The list row is a summary, so the full document, the action
 * engine and the cancel flow only mount on the first click (no N+1 on the list).
 */
export function DocumentRowActions(props: DocumentRowActionsProps) {
    const [armed, setArmed] = useState(false)
    if (!armed) {
        return (
            <div className="flex justify-center items-center">
                <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md transition-all duration-200 hover:scale-105 active:scale-95"
                    onClick={(e) => { e.stopPropagation(); setArmed(true) }}
                    aria-label="Más acciones"
                    type="button"
                >
                    <MoreVertical className="h-4 w-4" />
                </Button>
            </div>
        )
    }
    return props.kind === "invoice" ? <InvoiceRowMenu {...props} /> : <OrderRowMenu {...props} />
}

function toMenuItems(items: DocumentActionItem[], onOpen?: () => void): ActionMenuItem[] {
    const toItem = (item: DocumentActionItem): ActionMenuItem => ({
        icon: item.icon ?? ChevronRight,
        label: item.label,
        disabled: item.disabled,
        disabledReason: item.disabledReason,
        onClick: item.onClick,
    })
    const regular = items.filter((i) => !i.destructive).map(toItem)
    const destructive = items.filter((i) => i.destructive).map(toItem)
    const open: ActionMenuItem[] = onOpen ? [{ action: "detail", label: "Ver ficha", onClick: onOpen }] : []
    return [
        ...open,
        ...regular,
        ...(destructive.length > 0 && (open.length > 0 || regular.length > 0) ? [{ separator: true as const }] : []),
        ...destructive,
    ]
}

function makeItemBuilder(order: Order | null, engineRun: (actionId: string) => void) {
    return ({ action, disabled, disabledReason }: ResolvedDocumentAction<Order>): DocumentActionItem => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        disabled,
        disabledReason,
        onClick: () => (action.onClick && order ? action.onClick(order) : engineRun(action.id)),
    })
}

function OrderRowMenu({ id, kind, onOpen }: DocumentRowActionsProps) {
    const isSale = kind === "sale-order"
    const { order, permissions, isLoading, refetch } = useOrderDocument(id, isSale ? "sale" : "purchase")
    const invalidateDocuments = useInvalidateDocuments()
    const [editing, setEditing] = useState(false)

    const handleSuccess = () => {
        void refetch()
        void invalidateDocuments()
    }

    const engine = useOrderActionEngine({ order, onActionSuccess: handleSuccess })
    const { requestCancel, modalProps, isAnnulBlocked, annulBlockedReason } = useCancelOrderFlow(
        isSale ? "sale" : "purchase", { onSuccess: handleSuccess, orderId: order?.id },
    )
    const toItem = makeItemBuilder(order, engine.run)

    const items = useMemo(() => {
        if (!order) return []
        const registry = isSale ? saleOrderActions : purchaseOrderActions
        const plan = planOrderSheetActions(resolveRegistryActions(registry, order, permissions, (actionId) => SHEET_EXCLUDED_ACTIONS.has(actionId)))
        const list: DocumentActionItem[] = [
            ...(plan.primary ? [toItem(plan.primary)] : []),
            ...plan.secondary.map(toItem),
            ...plan.overflow.map(toItem),
        ]
        if (order.status === "DRAFT" && !isSale) {
            list.push({ id: "edit-order", label: "Editar orden", icon: Edit, onClick: () => setEditing(true) })
        }
        const cancelPerm = isSale ? "sales.cancel_saleorder" : "purchasing.cancel_purchaseorder"
        const annulPerm = isSale ? "sales.annul_saleorder" : "purchasing.annul_purchaseorder"
        if (order.status === "DRAFT" && permissions.includes(cancelPerm)) {
            list.push({ id: "cancel-order", label: "Cancelar orden", icon: Trash2, destructive: true, onClick: () => requestCancel(order.id) })
        } else if (order.status !== "CANCELLED" && order.status !== "DRAFT" && permissions.includes(annulPerm)) {
            list.push({
                id: "annul-order", label: "Anular orden", icon: Ban, destructive: true,
                disabled: isAnnulBlocked, disabledReason: annulBlockedReason || undefined,
                onClick: () => requestCancel(order.id),
            })
        }
        return list
        // toItem/requestCancel se recrean en cada render; el documento y los permisos gobiernan el resultado.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [order, permissions, isSale, isAnnulBlocked, annulBlockedReason])

    return (
        <>
            <DataCell.ActionMenu defaultOpen loading={isLoading} items={toMenuItems(items, onOpen && (() => onOpen(id)))} />
            {engine.host}
            <ActionConfirmModal {...modalProps} />
            {editing && order && (
                <PurchaseCheckoutWizard
                    open={editing}
                    onOpenChange={(isOpen) => { if (!isOpen) setEditing(false) }}
                    orderId={order.id}
                    order={null}
                    orderLines={[]}
                    total={0}
                    onComplete={() => {
                        setEditing(false)
                        handleSuccess()
                    }}
                />
            )}
        </>
    )
}

function InvoiceRowMenu({ id, onOpen }: DocumentRowActionsProps) {
    const { invoice, permissions, isLoading, refetch } = useInvoiceDocument(id)
    const invalidateDocuments = useInvalidateDocuments()
    const isSale = invoice ? (invoice.is_sale_document === true || !!invoice.sale_order) : true
    const isNote = invoice?.dte_type === "NOTA_CREDITO" || invoice?.dte_type === "NOTA_DEBITO"

    const handleSuccess = () => {
        void refetch()
        void invalidateDocuments()
    }

    const engine = useOrderActionEngine({ order: invoice, onActionSuccess: handleSuccess })
    const related = useOrderRelatedActions({ order: invoice, isSale, permissions, onSuccess: handleSuccess })
    const toItem = makeItemBuilder(invoice, engine.run)

    const items = useMemo(() => {
        if (!invoice) return []
        // NC/ND del registro buscan la factura entre `invoices`: la propia factura es su base.
        const actionDoc = isNote ? invoice : { ...invoice, invoices: [invoice] }
        const registry = isSale ? saleOrderActions : purchaseOrderActions
        const allowed = isNote ? NOTE_ACTIONS : INVOICE_ACTIONS
        const resolved = resolveRegistryActions(registry, actionDoc, permissions, (actionId) => !allowed.has(actionId))
        return [...resolved.map(toItem), ...related.invoiceActions({ id: invoice.id, status: invoice.status })]
        // toItem/related se recrean en cada render; el documento y los permisos gobiernan el resultado.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [invoice, permissions, isSale, isNote])

    return (
        <>
            <DataCell.ActionMenu defaultOpen loading={isLoading} items={toMenuItems(items, onOpen && (() => onOpen(id)))} />
            {engine.host}
            {related.host}
        </>
    )
}
