"use client"

import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import { useState, useMemo, useCallback } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { ActionConfirmModal } from '@/components/shared'
import { getDomainConceptTitle, getDomainConceptCode } from '@/lib/entity-registry'
import { workOrderActions, type WorkOrderActionsCtx } from '../workOrderActions'
import type { Page } from '@/lib/pagination'

import { useViewMode } from "@/hooks/useViewMode"
import { WorkOrderWizard } from "./WorkOrderWizard"
import { WorkOrderKanban } from "./WorkOrderKanban"
import { WorkOrderTimeline } from "./WorkOrderTimeline"
import { useWorkOrders } from "../hooks/useWorkOrders"
import { useWorkOrderListActions } from "../hooks/useWorkOrderListActions"
import { FadeIn, ToolbarCreateButton } from "@/components/shared"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { Collection, GROUP_ROW_LIMIT, useCollectionQuery, useEntityCollection, useServerPage, type CollectionViewMode } from "@/components/entity-view"
import { workOrderEntity, workOrderViews } from "../entity-view/workOrder.entity"
import type { WorkOrder, WizardMode } from "../types"

interface WorkOrdersClientViewProps {
    initialOrders?: WorkOrder[]
}

/** Maps useViewMode string to CollectionViewMode (unknown values fall back to "table"). */
function toCollectionView(v: string): CollectionViewMode {
    if (v === "card" || v === "kanban" || v === "timeline") return v
    return "table"
}

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

export function WorkOrdersClientView({ initialOrders }: WorkOrdersClientViewProps) {
    const { currentView, handleViewChange } = useViewMode("production.workorder")
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const query = useCollectionQuery(workOrderEntity)
    const { search, groupBy, params } = query
    const [pageState, setPageState] = useServerPage([params, groupBy], DEFAULT_PAGE)
    const { page, orders, isLoading, isRefetching, refetch: refetchOrders } = useWorkOrders({
        ...params,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    }, initialOrders ? { results: initialOrders, count: initialOrders?.length ?? 0 } as Page<WorkOrder> : undefined)

    const { annulOrder, duplicateOrder, bulkPrint, isBulkPrinting } = useWorkOrderListActions({ onSuccess: refetchOrders })

    const isNew = searchParams.get('new') === 'true' || searchParams.get('modal') === 'new'
    const requestedType = searchParams.get('type')
    const requestedProductId = searchParams.get('product_id') || undefined

    const wizardMode = useMemo((): WizardMode | null => {
        if (isNew) {
            return {
                kind: 'create',
                defaultOtType: requestedType === 'stock' ? 'NONE' : requestedType === 'sale' ? 'LINKED' : undefined,
                defaultProductId: requestedProductId ? String(requestedProductId) : undefined,
            }
        }
        return null
    }, [isNew, requestedType, requestedProductId])

    // ADR-0152: cada OT abre su propia pestaña (título = display_id de la fila); esta pestaña de página solo crea.
    const { openEntity } = useGlobalModals()
    useDeepLinkEntity("production.workorder")
    const handleManage = useCallback((id: number) => {
        openEntity("production.workorder", id, (orders as WorkOrder[]).find(o => o.id === id))
    }, [openEntity, orders])

    const closeWizard = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        ;['new', 'modal', 'type', 'product_id'].forEach(p => params.delete(p))
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const [annulOpen, setAnnulOpen] = useState(false)
    const [annulTargetId, setAnnulTargetId] = useState<number | null>(null)
    const duplicateConfirm = useConfirmAction<number>(async (id) => { await duplicateOrder({ id }) })

    const handleCancel = useCallback((id: number) => {
        setAnnulTargetId(id)
        setAnnulOpen(true)
    }, [])
    const handleDuplicate = useCallback((id: number) => duplicateConfirm.requestConfirm(id), [duplicateConfirm])

    const workOrderActionsCtx: WorkOrderActionsCtx = {
        onEdit: (id) => handleManage(id),
        onDuplicate: handleDuplicate,
        onAnnul: handleCancel,
    }

    const collection = useEntityCollection(
        workOrderEntity,
        {
            rows: orders as WorkOrder[],
            rowCount: page?.count ?? 0,
            isLoading,
            isRefetching,
            isFiltered: search.isFiltered,
        },
        {
            pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState },
            groupBy,
        },
    )

    const collectionView = toCollectionView(currentView)
    const isCustomView = currentView === "kanban" || currentView === "timeline"

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <EntityPanelTab label="production.workorder" id={null} open={!!wizardMode} onClose={closeWizard}>
                {(open) => wizardMode && (
                    <WorkOrderWizard
                        mode={wizardMode}
                        open={open}
                        onOpenChange={(open) => { if (!open) closeWizard() }}
                        onSuccess={() => { void refetchOrders() }}
                    />
                )}
            </EntityPanelTab>

            <div className="mt-2 flex-1 min-h-0 flex flex-col">
                <FadeIn key={currentView} className="h-full">
                    <Collection.Root
                        collection={collection}
                        query={query}
                        selection="bulk"
                        view={collectionView}
                        onViewChange={(v) => handleViewChange(v === "table" ? "list" : v)}
                        onOpen={(order: WorkOrder) => handleManage(order.id)}
                        actions={workOrderActions.forCollection(workOrderActionsCtx)}
                    >
                        <Collection.Toolbar action={<ToolbarCreateButton label="Nueva OT" href="/production/orders?modal=new" />} />

                        {!isCustomView && (
                            <Collection.View
                                table={workOrderViews.table}
                                card={workOrderViews.card}
                                emptyTitle="Aún no hay órdenes de trabajo"
                                emptyDescription="Crea una orden de trabajo para planificar y seguir la fabricación."
                                onResetFilters={search.clearAll}
                            />
                        )}

                        {currentView === "kanban" && (
                            <WorkOrderKanban
                                orders={orders as WorkOrder[]}
                                onManage={handleManage}
                                onDuplicate={handleDuplicate}
                                onAnnul={handleCancel}
                                isLoading={isLoading}
                            />
                        )}

                        {currentView === "timeline" && (
                            <WorkOrderTimeline
                                orders={orders as WorkOrder[]}
                                onManage={handleManage}
                                isLoading={isLoading}
                            />
                        )}

                        <Collection.BulkBar actions={[
                            {
                                key: 'print',
                                label: 'Imprimir todas',
                                intent: 'default',
                                disabled: () => isBulkPrinting,
                                onClick: async (items: WorkOrder[]) => {
                                    await bulkPrint({ ids: items.map(o => o.id) })
                                },
                            },
                        ]} />
                    </Collection.Root>
                </FadeIn>
            </div>

            <ActionConfirmModal
                open={annulOpen}
                onOpenChange={(open) => { if (!open) { setAnnulOpen(false); setAnnulTargetId(null) } }}
                onConfirm={async (reason) => {
                    if (annulTargetId !== null) await annulOrder({ id: annulTargetId, notes: reason ?? '' })
                }}
                title={`Anular ${getDomainConceptCode('ot')}`}
                description={`¿Está seguro de que desea ANULAR esta ${getDomainConceptCode('ot')}? Esto detendrá el proceso y liberará reservas.`}
                variant="destructive"
                requireReason
                reasonLabel="Motivo de anulación"
                reasonPlaceholder="Explique por qué se anula esta OT..."
            />
            <ActionConfirmModal
                open={duplicateConfirm.isOpen}
                onOpenChange={(open) => { if (!open) duplicateConfirm.cancel() }}
                onConfirm={duplicateConfirm.confirm}
                title={`Duplicar ${getDomainConceptCode('ot')}`}
                description={`Se creará una nueva ${getDomainConceptCode('ot')} en Borrador con los mismos materiales y configuración. No se vinculará a la ${getDomainConceptTitle('ov')} original.`}
                variant="default"
            />
        </div>
    )
}
