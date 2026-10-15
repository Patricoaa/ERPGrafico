"use client"

import { useState, useEffect, forwardRef, useImperativeHandle } from "react"
import { cn } from "@/lib/utils"
import { ActionConfirmModal, Chip } from '@/components/shared'
import { ActionButton } from "./ActionButton"
import {type ActionCategory as CategoryType} from "@/types/actions"
import { getActionBadgeCount } from '@/lib/action-utils'
import dynamic from "next/dynamic"
import { toast } from "sonner"
import { LazyDrawer } from "@/features/_shared"
import { useCancelOrderFlow } from "../hooks/useCancelOrderFlow"
import { useOrderActionEngine } from "../hooks/useOrderActionEngine"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { type Order } from "../types"
import type { DocumentItem } from "./DocumentListModal"

const DocumentListModal = dynamic(() => import("./DocumentListModal").then(m => m.DocumentListModal))

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

/**
 * Botonera de una categoría de acciones del Order Hub. La ejecución (modales, pagos, notas…)
 * vive en `useOrderActionEngine` (ADR-0083), compartido con la ficha documental.
 * @deprecated ADR-0083: el Hub se retira (U6); la ficha usa DocumentActionsMenu + el motor.
 */
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
}: ActionCategoryProps, ref: React.ForwardedRef<{ handleActionClick: (actionId: string) => void }>) => {
    const [viewConfig, setViewConfig] = useState<{ type: string, id: number | string } | null>(null)
    const [workOrdersOpen, setWorkOrdersOpen] = useState(false)
    const engine = useOrderActionEngine({ order, posSessionId, onActionSuccess })

    const { setHubTemporarilyHidden, triggerAction } = useHubPanel()

    useImperativeHandle(ref, () => ({
        handleActionClick
    }))

    const isSale = !!order?.customer_name || !!order?.customer || !!order?.sale_order

    const { modalProps: cancelModalProps, isModalOpen: isCancelModalOpen } =
        useCancelOrderFlow(isSale ? 'sale' : 'purchase', { onSuccess: onActionSuccess })

    // Oculta el Hub mientras hay un modal abierto (sin pisar otras instancias)
    const isAnyModalActive = engine.isModalOpen || !!viewConfig || workOrdersOpen || isCancelModalOpen
    useEffect(() => {
        if (isAnyModalActive) {
            setHubTemporarilyHidden(true)
            return () => {
                setHubTemporarilyHidden(false)
            }
        }
    }, [isAnyModalActive, setHubTemporarilyHidden])

    const resolvedInvoices = (order?.dte_type ? [order] : (order?.related_documents?.invoices || order?.invoices)) || []

    const handleActionClick = (actionId: string) => {
        if (!order) {
            toast.error("Error: Los datos del pedido no han cargado. Reintente en un momento.");
            return;
        }

        const action = category.actions.find(a => a.id === actionId)
        if (action?.onClick) {
            action.onClick(order)
            return
        }

        // PERF-09 & HUB-05: una instancia visible delega en el motor global estable
        if (!headless) {
            triggerAction(actionId);
            return;
        }

        switch (actionId) {
            case 'view-work-orders':
                setWorkOrdersOpen(true)
                break
            case 'view-documents':
            case 'view-receptions':
            case 'view-deliveries': {
                const docs = actionId === 'view-documents'
                    ? resolvedInvoices
                    : (isSale ? (order?.related_documents?.deliveries || []) : (order?.related_documents?.receipts || []))

                if (docs.length === 0) {
                    toast.error("No se han encontrado documentos.")
                    return
                }

                const targetDoc = docs[0] as Record<string, unknown>
                const viewType = targetDoc.docType as string || (actionId === 'view-documents' ? 'invoice' : (isSale ? 'sale_delivery' : 'inventory'))
                const viewId = actionId === 'view-documents' ? targetDoc.id as number | string : ((targetDoc.id as number | string) || targetDoc.stock_move_id as number | string)

                if (!viewId) {
                    toast.error("Error al identificar el documento.")
                    return
                }
                setViewConfig({ type: viewType, id: viewId })
                break
            }
            default:
                engine.run(actionId)
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
    if (!headless && filteredActions.length === 0 && !isAnyModalActive) return null

    return (
        <>
            {!headless && (
                <div className={cn(
                    layout === 'grid' ? "space-y-0" : (ghost || layout === 'flex' ? "space-y-2" : "card-flat p-4 space-y-4")
                )}>
                    {layout === 'list' && (category.icon || category.label) && (
                        <div className="flex items-center gap-2 pb-2 border-b border-border">
                            {category.icon && (
                                <div className="p-1.5 rounded bg-primary/10 text-primary border border-primary/10">
                                    <category.icon className="h-3.5 w-3.5" />
                                </div>
                            )}
                            {category.label && <h3 className=" font-bold uppercase text-xs tracking-wider">{category.label}</h3>}
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

            {engine.host}
            {viewConfig && (
                <LazyDrawer
                    type={viewConfig.type}
                    id={viewConfig.id}
                    open={true}
                    onOpenChange={(open) => !open && setViewConfig(null)}
                />
            )}
            {workOrdersOpen && (
                <DocumentListModal
                    open={true}
                    onOpenChange={(open) => !open && setWorkOrdersOpen(false)}
                    type="work_orders"
                    data={(order?.work_orders || []) as unknown as DocumentItem[]}
                    onItemClick={(type, id) => {
                        setWorkOrdersOpen(false)
                        setViewConfig({ type, id })
                    }}
                />
            )}
            <ActionConfirmModal {...cancelModalProps} />
        </>
    )
})

ActionCategory.displayName = "ActionCategory"
