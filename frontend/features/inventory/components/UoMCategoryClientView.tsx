"use client"

import { showApiError } from "@/lib/errors"

import React, { useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
// deleteUoMCategory consumido vía useUoMs.
import { ActionConfirmModal, DataTableColumnHeader, DataTableView, EntityCard } from '@/components/shared'
import { DataCell } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Trash2 } from "lucide-react"
import type { BulkAction } from "@/components/shared"
import { UoMCategoryDrawer } from "./UoMCategoryDrawer"
import { uomCategoryActions, type UoMCategoryActionsCtx } from "@/features/inventory/uomCategoryActions"
import { toast } from "sonner"

import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

interface UoMCategory {
    id: number
    name: string
}

interface UoMCategoryClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

import { useUoMs } from "@/features/inventory/hooks/useUoMs"
import { SmartSearchBar, useClientSearch } from "@/components/shared"
import { uomCategorySearchDef } from "@/features/inventory/searchDef"

export function UoMCategoryClientView({ externalOpen, onExternalOpenChange, createAction }: UoMCategoryClientViewProps) {
    const { categories, isLoading, refetch, deleteUoMCategory } = useUoMs()
    const { filterFn, isFiltered } = useClientSearch<UoMCategory>(uomCategorySearchDef)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const isCreateModal = searchParams.get("modal") === "new"
    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<UoMCategory>({ endpoint: '/inventory/uom-categories' })
    const { openSelected } = useEntityRouteActions()

    const dialogOpen = isCreateModal || !!selectedFromUrl || !!externalOpen

    const handleCloseModal = () => {
        clearSelection()
        onExternalOpenChange?.(false)
        if (searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleSave = async (category?: UoMCategory) => {
        if (category) {
            handleCloseModal()
            refetch()
        }
    }

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            // deleteUoMCategory invalida UOM_CATEGORIES + UOMS (category_name derivado)
            // y emite el toast desde el hook.
            await deleteUoMCategory(id)
        } catch (error) {
            showApiError(error, "Error al eliminar (puede estar en uso)")
        }
    })

    const bulkDeleteConfirm = useConfirmAction<UoMCategory[]>(async (items) => {
        try {
            await Promise.all(items.map(c => deleteUoMCategory(c.id)))
            toast.success(`${items.length} categorías eliminadas`)
        } catch (error) {
            showApiError(error, "Error al eliminar las categorías (pueden tener unidades asociadas)")
            throw error
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const actionsCtx: UoMCategoryActionsCtx = {
        onEdit: (item) => openSelected(item.id),
        onDelete: (id) => handleDelete(id),
    }

    const columns = useMemo<ColumnDef<UoMCategory>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                    variant="circle"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                    variant="circle"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        },
        {
            accessorKey: "id",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Código Interno" className="justify-center" />,
            cell: ({ row }) => <DataCell.Code>{row.getValue("id")}</DataCell.Code>,
            size: 80,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text>
                    {row.getValue("name")}
                </DataCell.Text>
            ),
        },
        uomCategoryActions.column(actionsCtx),
    ], [actionsCtx])

    const bulkActions = useMemo<BulkAction<UoMCategory>[]>(() => [
        {
            key: "delete",
            label: "Eliminar",
            icon: Trash2,
            intent: "destructive",
            onClick: async (items) => bulkDeleteConfirm.requestConfirm(items),
        },
    ], [deleteUoMCategory, bulkDeleteConfirm])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={filterFn(categories)}
                    isLoading={isLoading}
                    entityLabel="inventory.uomcategory"
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={uomCategorySearchDef} placeholder="Buscar categoría..." className="w-full" />}
                    pageSizeOptions={[10, 20]}
                    bulkActions={bulkActions}
                    createAction={createAction}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay categorías de medida",
                        description: "Agrupa unidades de medida relacionadas (peso, longitud, volumen…).",
                    }}
                    renderCard={(cat: UoMCategory) => (
                        <EntityCard onClick={() => openSelected(cat.id)}>
                            <EntityCard.Header title={cat.name} />
                            <EntityCard.Body actions={uomCategoryActions.render(cat, actionsCtx)} />
                        </EntityCard>
                    )}
                />
            </div>

            <UoMCategoryDrawer
                open={dialogOpen}
                onOpenChange={(open) => {
                    if (!open) handleCloseModal()
                }}
                initialData={isCreateModal ? undefined : (selectedFromUrl ?? undefined)}
                onSuccess={handleSave}
            />

            <ActionConfirmModal
                open={deleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteConfirm.cancel() }}
                onConfirm={deleteConfirm.confirm}
                title="Eliminar Categoría"
                description="¿Eliminar categoría? Esto eliminará las unidades asociadas y no se puede deshacer."
                variant="destructive"
            />

            <ActionConfirmModal
                open={bulkDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkDeleteConfirm.cancel() }}
                onConfirm={bulkDeleteConfirm.confirm}
                title="Eliminar Categorías"
                description={`¿Está seguro de que desea eliminar ${bulkDeleteConfirm.payload?.length ?? 0} categorías de unidades?`}
                variant="destructive"
            />
        </div>
    )
}
