"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { usePathname } from "next/navigation"
import { ActionConfirmModal } from '@/components/shared'
import { getDomainConceptTitle, getDomainConceptCode } from '@/lib/entity-registry'
import { workOrderActions, type WorkOrderActionsCtx } from '@/features/production'
import type { Page } from '@/lib/pagination'

import { useViewMode } from "@/hooks/useViewMode"
import {
    WorkOrderWizard,
    WorkOrderKanban,
    WorkOrderTimeline,
    useWorkOrders,
    useWorkOrderListActions,
} from "@/features/production"
import { FadeIn, ToolbarCreateButton, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { workOrderUnifiedSearchDef } from "@/features/production"
import { toast } from "sonner"
import { Collection, useEntityCollection, type CollectionViewMode } from "@/components/entity-view"
import { workOrderEntity, workOrderViews, type WorkOrder } from "@/features/production/entity-view/workOrder.entity"

import type { WizardMode, StageId } from "@/features/production/types"

interface WorkOrdersPageClientProps {
    initialOrders?: WorkOrder[]
}

/** Maps useViewMode string to CollectionViewMode (kanban/timeline fall back to "table"). */
function toCollectionView(v: string): CollectionViewMode {
    if (v === "card") return "card"
    if (v === "analytics") return "analytics"
    return "table"
}

export default function WorkOrdersPageClient({ initialOrders }: WorkOrdersPageClientProps) {
    const { currentView, handleViewChange } = useViewMode("production.workorder")
    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const search = useUnifiedSearch(workOrderUnifiedSearchDef)
    const allFilters = { ...search.filters }
    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, orders, isLoading, isRefetching, refetch: refetchOrders } = useWorkOrders({
        ...allFilters,
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? 5000 : pageState.pageSize,
    }, initialOrders ? { results: initialOrders, count: initialOrders?.length ?? 0 } as Page<WorkOrder> : undefined)

    const totalCount = page?.count ?? 0
    const isOverLimit = isGrouping && totalCount > 5000
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])

    const { deleteOrder, annulOrder, duplicateOrder, bulkPrint, isBulkPrinting } = useWorkOrderListActions({ onSuccess: refetchOrders })

    const isNew = searchParams.get('new') === 'true' || searchParams.get('modal') === 'new'
    const selectedId = searchParams.get('selected')
    const requestedType = searchParams.get('type')
    const requestedProductId = searchParams.get('product_id') || undefined
    const requestedStage = searchParams.get('step') || undefined

    const wizardMode = useMemo((): WizardMode | null => {
        if (isNew) {
            return {
                kind: 'create',
                defaultOtType: requestedType === 'stock' ? 'NONE' : requestedType === 'sale' ? 'LINKED' : undefined,
                defaultProductId: requestedProductId ? String(requestedProductId) : undefined,
            }
        }
        if (selectedId) {
            return {
                kind: 'manage',
                orderId: Number(selectedId),
                targetStage: requestedStage as StageId | undefined,
            }
        }
        return null
    }, [isNew, selectedId, requestedType, requestedProductId, requestedStage])

    const handleManage = useCallback((id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const closeWizard = useCallback(() => {
        const params = new URLSearchParams(searchParams.toString())
        ;['new', 'modal', 'selected', 'type', 'product_id', 'step'].forEach(p => params.delete(p))
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname, searchParams])

    const deleteConfirm = useConfirmAction<number>(async (id) => { await deleteOrder({ id }) })
    const cancelConfirm = useConfirmAction<number>(async (id) => { await annulOrder({ id }) })
    const duplicateConfirm = useConfirmAction<number>(async (id) => { await duplicateOrder({ id }) })

    const handleDelete = useCallback((id: number) => deleteConfirm.requestConfirm(id), [deleteConfirm])
    const handleCancel = useCallback((id: number) => cancelConfirm.requestConfirm(id), [cancelConfirm])
    const handleDuplicate = useCallback((id: number) => duplicateConfirm.requestConfirm(id), [duplicateConfirm])

    const workOrderActionsCtx: WorkOrderActionsCtx = {
        onEdit: (id) => handleManage(id),
        onDuplicate: handleDuplicate,
        onAnnul: handleCancel,
        onDelete: handleDelete,
    }

    const groupBy = null // WorkOrder groupBy uses search.groupBy for data fetch, not entity-view groupBy

    const collection = useEntityCollection(
        workOrderEntity,
        {
            rows: orders as WorkOrder[],
            rowCount: totalCount,
            isLoading,
            isRefetching,
            isFiltered: search.isFiltered,
        },
        {
            pagination: effectiveGrouping
                ? { mode: "none" }
                : { mode: "server", state: pageState, onChange: setPageState },
            groupBy,
        },
    )

    const collectionView = toCollectionView(currentView)
    const isCustomView = currentView === "kanban" || currentView === "timeline"

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            {wizardMode && (
                <WorkOrderWizard
                    mode={wizardMode}
                    open={true}
                    onOpenChange={(open) => { if (!open) closeWizard() }}
                    onSuccess={() => { void refetchOrders() }}
                />
            )}

            <div className="mt-2 flex-1 min-h-0 flex flex-col">
                <FadeIn key={currentView} className="h-full">
                    <Collection.Root
                        collection={collection}
                        selection="bulk"
                        view={collectionView}
                        onViewChange={(v) => handleViewChange(v === "table" ? "list" : v)}
                        onOpen={(order: WorkOrder) => handleManage(order.id)}
                        actions={workOrderActions.forCollection(workOrderActionsCtx)}
                    >
                        <Collection.Toolbar action={<ToolbarCreateButton label="Nueva OT" href="/production/orders?modal=new" />}>
                            <UnifiedSearchBar
                                config={workOrderUnifiedSearchDef}
                                chips={search.chips}
                                isFiltered={search.isFiltered}
                                inputValue={search.inputValue}
                                onInputChange={search.setInputValue}
                                onApply={search.applyFilter}
                                onRemove={search.removeFilter}
                                onClearAll={search.clearAll}
                                groupBy={search.groupBy}
                                onGroupBySelect={search.setGroupBy}
                                paramValues={search.paramValues}
                                placeholder="Buscar OTs..."
                            />
                        </Collection.Toolbar>

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
                                onDelete={handleDelete}
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
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar OT"
                description="¿Está seguro de que desea eliminar esta OT? Esta acción es irreversible."
                variant="destructive"
            />
            <ActionConfirmModal
                open={cancelConfirm.isOpen}
                onOpenChange={(open) => { if (!open) cancelConfirm.cancel() }}
                onConfirm={cancelConfirm.confirm}
                title={`Anular ${getDomainConceptCode('ot')}`}
                description={`¿Está seguro de que desea ANULAR esta ${getDomainConceptCode('ot')}? Esto detendrá el proceso y liberará reservas.`}
                variant="destructive"
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
