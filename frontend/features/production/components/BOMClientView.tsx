"use client"

import React from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { ActionConfirmModal } from '@/components/shared'
import { Collection, useCollectionViewMode, useEntityCollection, type FieldId } from "@/components/entity-view"
import { BOMDrawer, useAllBOMs, useBOM, useDeleteBomMutation } from "@/features/production"
import { bomActions, type BOMActionsCtx } from "./bomActions"
import { bomEntity, bomViews } from "../entity-view/bom.entity"

import { ToolbarCreateButton, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from "@/components/shared"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { getDomainConceptTitle, getDomainConceptCode, getDomainConceptMessage } from "@/lib/entity-registry"
import { bomUnifiedSearchDef } from "@/features/production"

import type { BOM, ProductMinimal } from "@/features/production/types"

export interface BOMListItem extends BOM {
    product_name: string
    product_code: string
    product_internal_code?: string
    lines_count: number
    total_cost: number
}

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const BOM_GROUPS: Record<string, FieldId<typeof bomEntity.fields>> = { active: "active" }

interface BOMClientViewProps {
    initialBoms?: BOM[]
}

export function BOMClientView({ initialBoms }: BOMClientViewProps) {


    const searchParams = useSearchParams()
    const router = useRouter()
    const isNewModalOpen = searchParams.get("modal") === "new"
    const selectedId = searchParams.get("selected") ? Number(searchParams.get("selected")) : null
    const isFormOpen = isNewModalOpen || !!selectedId
    const editingBomId = selectedId

    const { deleteBom } = useDeleteBomMutation()
    const { data: editingBomData } = useBOM(editingBomId ?? undefined)

    const search = useUnifiedSearch(bomUnifiedSearchDef)
    const allFilters = { ...search.filters }
    const { boms, isLoading: loading, isRefetching, isError, refetch: refetchBoms } = useAllBOMs(allFilters, initialBoms)
    const groupBy = search.groupBy ? BOM_GROUPS[search.groupBy] ?? null : null
    const { view, onViewChange } = useCollectionViewMode("production.bom")
    const collection = useEntityCollection(
        bomEntity,
        { rows: boms, isLoading: loading, isRefetching, error: isError, refetch: refetchBoms, isFiltered: search.isFiltered },
        // Groups span the whole list, not one page.
        { pagination: groupBy ? { mode: "none" } : { mode: "client", pageSize: 20 }, groupBy },
    )


    const handleFormClose = (open: boolean) => {
        if (!open) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            params.delete("selected")
            router.push(`?${params.toString()}`, { scroll: false })
        }
    }

    const handleEdit = (id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set("selected", String(id))
        router.push(`?${params.toString()}`, { scroll: false })
    }

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
                view={view}
                onViewChange={onViewChange}
                onOpen={(bom) => bom.id != null && handleEdit(bom.id)}
                actions={bomActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar config={bomUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar por producto..." />
                </Collection.Toolbar>
                <Collection.View
                    table={bomViews.table}
                    card={bomViews.card}
                    emptyTitle={`Aún no hay ${getDomainConceptTitle('ldm', true).toLowerCase()}`}
                    emptyDescription={`Crea una ${getDomainConceptTitle('ldm').toLowerCase()} (${getDomainConceptCode('ldm')}) para definir cómo se fabrica un producto.`}
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>

            <BOMDrawer
                open={isFormOpen}
                onOpenChange={handleFormClose}
                onSuccess={refetchBoms}
                bomToEdit={editingBomData as BOM | undefined}
                product={editingBomData ? {
                    id: (editingBomData as unknown as { product: number }).product,
                    name: (editingBomData as unknown as BOMListItem).product_name,
                    code: (editingBomData as unknown as BOMListItem).product_code
                } as unknown as ProductMinimal : undefined}
            />

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
