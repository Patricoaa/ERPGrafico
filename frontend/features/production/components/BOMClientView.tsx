"use client"

import { useCreatePanelRoute } from "@/hooks/useCreatePanelRoute"
import { EntityPanelTab, useGlobalModals } from "@/components/providers"
import { useDeepLinkEntity } from "@/hooks/useDeepLinkEntity"
import React from "react"
import { ActionConfirmModal } from '@/components/shared'
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { BOMDrawer, useAllBOMs, useDeleteBomMutation } from "@/features/production"
import { bomActions, type BOMActionsCtx } from "./bomActions"
import { bomEntity, bomViews } from "../entity-view/bom.entity"

import { ToolbarCreateButton } from "@/components/shared"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { getDomainConceptTitle, getDomainConceptCode, getDomainConceptMessage } from "@/lib/entity-registry"

import type { BOM } from "@/features/production/types"


interface BOMClientViewProps {
    initialBoms?: BOM[]
}

export function BOMClientView({ initialBoms }: BOMClientViewProps) {


    // La creación (`?modal=new`) es la pestaña de página; editar abre la pestaña de la BOM (ADR-0152).
    const panel = useCreatePanelRoute({ resolved: false })
    const { openEntity } = useGlobalModals()
    useDeepLinkEntity("production.bom")

    const { deleteBom } = useDeleteBomMutation()

    const query = useCollectionQuery(bomEntity, { sorting: "client" })
    const { search, groupBy } = query
    const allFilters = { ...query.params }
    const { boms, isLoading: loading, isRefetching, isError, refetch: refetchBoms } = useAllBOMs(allFilters, initialBoms)
    const { view, onViewChange } = useCollectionViewMode("production.bom")
    const collection = useEntityCollection(
        bomEntity,
        { rows: boms, isLoading: loading, isRefetching, error: isError, refetch: refetchBoms, isFiltered: search.isFiltered },
        // Groups span the whole list, not one page.
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy, sorting: query.sorting },
    )


    const handleEdit = (id: number) => openEntity("production.bom", id)

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        await deleteBom(id)
        refetchBoms()
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const actionsCtx: BOMActionsCtx = {
        onEdit: handleEdit,
        onDelete: handleDelete,
    }

    const createAction = <ToolbarCreateButton label="Nueva Lista" href="/production/boms?modal=new" />

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                query={query}
                view={view}
                onViewChange={onViewChange}
                actions={bomActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction} />
                <Collection.View
                    table={bomViews.table}
                    card={bomViews.card}
                    emptyTitle={`Aún no hay ${getDomainConceptTitle('ldm', true).toLowerCase()}`}
                    emptyDescription={`Crea una ${getDomainConceptTitle('ldm').toLowerCase()} (${getDomainConceptCode('ldm')}) para definir cómo se fabrica un producto.`}
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <EntityPanelTab label="production.bom" {...panel.tab}>
                {(open) => (
                    <BOMDrawer
                        open={open}
                        onOpenChange={(open) => { if (!open) panel.close() }}
                        onSuccess={refetchBoms}
                    />
                )}
            </EntityPanelTab>

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title={getDomainConceptMessage('ldm', 'delete')}
                description={`¿Está seguro de eliminar esta ${getDomainConceptTitle('ldm')}? Esta acción no se puede deshacer.`}
                variant="destructive"
            />
        </div>
    )
}
