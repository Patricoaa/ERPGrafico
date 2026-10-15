"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Ban, Edit, FileText, Link2, ListOrdered, Trash2 } from "lucide-react"
import {
    ActionConfirmModal,
    DataTable,
    DocumentActionBar,
    DocumentDrawerShell,
    DocumentLifecycle,
    type DocumentActionItem,
    type DocumentSheetTab,
} from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { ActivitySidebar } from "@/features/audit"
import { PrintableLayout, useDrawerIdentity, usePrintableDrawer } from "@/features/_shared"
import {
    DocumentRelationsTab,
    resolveRegistryActions,
    useDocumentRelations,
    useInvalidateDocuments,
    type DocumentDomain,
    type ResolvedDocumentAction,
} from "@/features/documents"
import { saleOrderActions } from "@/features/sales"
import { purchaseOrderActions } from "@/features/purchasing"
import { useOrderHubData } from "@/hooks/useOrderHubData"
import { useCancelOrderFlow } from "../../hooks/useCancelOrderFlow"
import { useOrderActionEngine } from "../../hooks/useOrderActionEngine"
import { useOrderRelatedActions } from "../../hooks/useOrderRelatedActions"
import { getOrderLifecycle } from "../../utils/lifecycle"
import { planOrderSheetActions, SHEET_EXCLUDED_ACTIONS } from "../../utils/orderSheetActions"
import { orderLineFields } from "../../orderLineFields"
import type { Order, OrderLine } from "../../types"
import { OrderSummaryTab } from "./OrderSummaryTab"

export interface OrderSheetProps {
    id: number | null
    kind: "sale" | "purchase"
    open: boolean
    onOpenChange: (open: boolean) => void
    /** Sin Drawer: cuerpo incrustado (POS, decisión U-5 del plan). */
    embedded?: boolean
    /** Pagos registrados desde el POS quedan en su sesión. */
    posSessionId?: number | null
    onActionSuccess?: () => void
}

const LABEL = { sale: "sales.saleorder", purchase: "purchasing.purchaseorder" } as const
const AUDIT_TYPE = { sale: "sale_order", purchase: "purchase_order" } as const
const LIFECYCLE_DOMAINS = new Set<string>(["origin", "billing", "production", "logistics", "treasury"])

/**
 * Ficha documental de OV/OC (ADR-0083). Reemplaza el Order Hub: ciclo, acciones y relaciones
 * viven dentro de la ficha. Tabs: Resumen · Líneas · Relaciones.
 */
export function OrderSheet({ id, kind, open, onOpenChange, embedded = false, posSessionId = null, onActionSuccess }: OrderSheetProps) {
    const router = useRouter()
    const label = LABEL[kind]
    const isSale = kind === "sale"

    // TODO(U6): reemplazar por los hooks de detalle de cada feature al retirar el Hub.
    const hub = useOrderHubData({ orderId: id, type: kind, enabled: open || embedded })
    const { loading, isError, fetchOrderDetails } = hub
    const order = (hub.activeDoc ?? null) as Order | null
    const permissions = hub.userPermissions as string[]
    const { data: relations } = useDocumentRelations(label, order?.id ?? null)
    const invalidateDocuments = useInvalidateDocuments()

    const [tab, setTab] = useState("summary")
    const [domain, setDomain] = useState<DocumentDomain | null>(null)

    const handleSuccess = () => {
        void fetchOrderDetails()
        void invalidateDocuments()
        onActionSuccess?.()
    }

    const engine = useOrderActionEngine({ order, posSessionId, onActionSuccess: handleSuccess })
    const related = useOrderRelatedActions({ order, isSale, permissions, onSuccess: handleSuccess })
    const { requestCancel, modalProps: cancelModalProps, isAnnulBlocked, annulBlockedReason } = useCancelOrderFlow(
        kind, { onSuccess: handleSuccess, orderId: order?.id },
    )

    const { printRef, handlePrint } = usePrintableDrawer()
    const identity = useDrawerIdentity(label, "view", order, {
        overrideTitle: order?.display_id ?? order?.number ?? (isSale ? "Orden de Venta" : "Orden de Compra"),
        onPrint: handlePrint,
    })

    const plan = useMemo(() => {
        const registry = isSale ? saleOrderActions : purchaseOrderActions
        return planOrderSheetActions(resolveRegistryActions(registry, order, permissions, (actionId) => SHEET_EXCLUDED_ACTIONS.has(actionId)))
    }, [isSale, order, permissions])

    const toItem = ({ action, disabled, disabledReason }: ResolvedDocumentAction<Order>): DocumentActionItem => ({
        id: action.id,
        label: action.label,
        icon: action.icon,
        disabled,
        disabledReason,
        onClick: () => (action.onClick && order ? action.onClick(order) : engine.run(action.id)),
    })

    const managementActions: DocumentActionItem[] = []
    if (order && permissions.includes(isSale ? "sales.delete_saleorder" : "purchasing.delete_purchaseorder")) {
        if (order.status === "DRAFT") {
            managementActions.push({ id: "cancel-order", label: "Cancelar orden", icon: Trash2, destructive: true, onClick: () => requestCancel(order.id) })
        } else if (order.status !== "CANCELLED") {
            managementActions.push({
                id: "annul-order", label: "Anular orden", icon: Ban, destructive: true,
                disabled: isAnnulBlocked, disabledReason: annulBlockedReason || undefined,
                onClick: () => requestCancel(order.id),
            })
        }
    }
    if (order?.status === "DRAFT" && !isSale) {
        managementActions.unshift({ id: "edit-order", label: "Editar orden", icon: Edit, onClick: () => router.push(`/purchasing/checkout?orderId=${order.id}`) })
    }

    const sectionActions = useMemo(() => {
        const result: Partial<Record<DocumentDomain, DocumentActionItem[]>> = {}
        for (const [d, items] of Object.entries(plan.byDomain) as [DocumentDomain, ResolvedDocumentAction<Order>[]][]) {
            result[d] = items.map(toItem)
        }
        return result
        // toItem depende de order/engine, ya cubiertos por plan
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [plan])

    const lifecycle = order ? getOrderLifecycle(order, kind) : null
    const lines: OrderLine[] = order?.lines ?? order?.items ?? []
    const columns = useMemo(() => orderLineFields.toColumns(), [])

    const openRelationsAt = (stepId: string) => {
        setDomain(LIFECYCLE_DOMAINS.has(stepId) ? (stepId as DocumentDomain) : null)
        setTab("relations")
    }

    const tabs: DocumentSheetTab[] = order ? [
        { value: "summary", label: "Resumen", icon: FileText, content: <OrderSummaryTab order={order} kind={kind} /> },
        {
            value: "lines", label: "Líneas", icon: ListOrdered, badge: lines.length,
            content: <DataTable columns={columns} data={lines} variant="minimal" />,
        },
        {
            value: "relations", label: "Relaciones", icon: Link2, badge: relations?.relations.length,
            content: (
                <DocumentRelationsTab
                    label={label}
                    id={order.id}
                    sectionActions={sectionActions}
                    rowActions={related.rowActions}
                    domain={domain}
                    onDomainChange={setDomain}
                />
            ),
        },
    ] : []

    return (
        <>
            {order && (
                <PrintableLayout
                    ref={printRef}
                    title={isSale ? "Comprobante de Venta" : "Orden de Compra"}
                    displayId={order.display_id ?? order.number}
                    subtitle={isSale ? (typeof order.customer_name === "string" ? order.customer_name : undefined) : order.supplier_name}
                >
                    {lines.map((line, idx) => (
                        <div key={line.id ?? idx} className="flex justify-between text-3xs">
                            <span className="flex-1">{line.description || line.product_name}</span>
                            <span className="w-12 text-right">{Math.round(Number(line.quantity))}</span>
                            <span className="w-16 text-right">{formatCurrency(Number(line.unit_price ?? line.price_unit ?? 0))}</span>
                        </div>
                    ))}
                    <div className="flex justify-between font-bold border-t mt-2 pt-1 text-xs">
                        <span>Total</span>
                        <span>{formatCurrency(Number(order.total))}</span>
                    </div>
                </PrintableLayout>
            )}

            <DocumentDrawerShell
                open={open}
                onOpenChange={onOpenChange}
                embedded={embedded}
                title={identity.title}
                subtitle={identity.subtitle}
                icon={identity.icon}
                headerActions={identity.headerActions}
                isLoading={loading || (!order && !isError)}
                error={isError ? new Error("No se pudo cargar la orden") : undefined}
                loadingLabel={isSale ? "Cargando orden de venta" : "Cargando orden de compra"}
                lifecycle={lifecycle && (
                    <DocumentLifecycle
                        steps={lifecycle.steps}
                        figures={lifecycle.figures}
                        onStepClick={openRelationsAt}
                        activeStepId={tab === "relations" ? domain : null}
                    />
                )}
                actionBar={
                    <DocumentActionBar
                        primary={plan.primary ? toItem(plan.primary) : null}
                        secondary={plan.secondary.map(toItem)}
                        overflow={[...plan.overflow.map(toItem), ...managementActions]}
                    />
                }
                tabs={tabs}
                tab={tab}
                onTabChange={setTab}
                sidebar={order && !embedded ? <ActivitySidebar entityType={AUDIT_TYPE[kind]} entityId={order.id} /> : undefined}
            />

            {engine.host}
            {related.host}
            <ActionConfirmModal {...cancelModalProps} />
        </>
    )
}
