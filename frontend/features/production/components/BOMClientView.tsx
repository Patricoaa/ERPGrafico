"use client"

import React, { useMemo } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { ActionConfirmModal, DataTableView, AutoEntityCard } from '@/components/shared'
import { BOMDrawer, useAllBOMs, useBOM, useDeleteBomMutation } from "@/features/production"
import { bomActions, type BOMActionsCtx } from "./bomActions"
import { bomFields } from "@/features/production/bomFields"

import { ToolbarCreateButton, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { bomUnifiedSearchDef } from "@/features/production"

import type { BOM, ProductMinimal } from "@/features/production/types"

export interface BOMListItem extends BOM {
    product_name: string
    product_code: string
    product_internal_code?: string
    lines_count: number
    total_cost: number
}

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
    const { boms, isLoading: loading, isRefetching, refetch: refetchBoms } = useAllBOMs(allFilters, initialBoms)


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

    const columns: ColumnDef<BOMListItem>[] = useMemo(() => [
        ...bomFields.toColumns(),
        bomActions.auto(actionsCtx),
    ], [])

    return (
        <div className="flex-1 min-h-0 flex flex-col">

            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={boms as unknown as BOMListItem[]}
                    isLoading={loading}
                    isRefetching={isRefetching}
                    entityLabel="production.bom"
                    variant="embedded"
                    defaultPageSize={20}
                    unifiedSearch={<UnifiedSearchBar
                        config={bomUnifiedSearchDef}
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
                        placeholder="Buscar por producto..."
                    />}
                    unifiedSearchConfig={bomUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    createAction={<ToolbarCreateButton label="Nueva Lista" href="/production/boms?modal=new" />}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "bom",
                        title: "Aún no hay listas de materiales",
                        description: "Crea una lista de materiales (BOM) para definir cómo se fabrica un producto.",
                    }}
                    renderCard={(bom: BOMListItem) => (
                        <AutoEntityCard
                            key={bom.id}
                            data={bom}
                            fields={bomFields}

                            entityLabel="production.bom"

                            actions={bomActions.render(bom, actionsCtx)}
                            defaultAction={bomActions.defaultAction(actionsCtx)?.(bom) ?? (() => bom.id != null && handleEdit(bom.id))}
                        />
                    )}
                />
            </div>

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
                title="Eliminar Lista de Materiales"
                description="¿Está seguro de eliminar esta Lista de Materiales? Esta acción no se puede deshacer."
                variant="destructive"
            />
        </div>
    )
}
