"use client"

import { showApiError } from "@/lib/errors"

import React, { useEffect, useState, useMemo } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import api from "@/lib/api"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import { Pencil, Trash2 } from "lucide-react"
import type { BulkAction } from "@/components/shared"
import { UoMCategoryForm } from "./UoMCategoryForm"
import { toast } from "sonner"

import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared/ActionConfirmModal"

interface UoMCategory {
    id: number
    name: string
}

interface UoMCategoryListProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

import { useUoMs } from "@/features/inventory/hooks/useUoMs"
import { SmartSearchBar, useClientSearch } from "@/components/shared"
import { uomCategorySearchDef } from "@/features/inventory/searchDef"

export function UoMCategoryList({ externalOpen, onExternalOpenChange, createAction }: UoMCategoryListProps) {
    const { categories, isLoading, refetch } = useUoMs()
    const { filterFn } = useClientSearch<UoMCategory>(uomCategorySearchDef)

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [currentCategory, setCurrentCategory] = useState<Partial<UoMCategory>>({})

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        setIsModalOpen(false)
        setCurrentCategory({})
        onExternalOpenChange?.(false)

        if (externalOpen || searchParams.get("modal")) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        }
    }

    const handleSave = async (category?: UoMCategory) => {
        setIsModalOpen(false)
        if (category) {
            refetch()
        }
    }

    const deleteConfirm = useConfirmAction<number>(async (id) => {
        try {
            await api.delete(`/inventory/uom-categories/${id}/`)
            toast.success("Categoría eliminada")
            refetch()
        } catch (error) {
            showApiError(error, "Error al eliminar (puede estar en uso)")
        }
    })

    const handleDelete = (id: number) => deleteConfirm.requestConfirm(id)

    const columns = useMemo<ColumnDef<UoMCategory>[]>(() => [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={table.getIsAllPageRowsSelected()}
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
            size: 40,
        },
        {
            accessorKey: "name",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Nombre" className="justify-center" />,
            cell: ({ row }) => (
                <DataCell.Text className="text-center w-full">
                    {row.getValue("name")}
                </DataCell.Text>
            ),
        },
        createActionsColumn<UoMCategory>({
            renderActions: (item) => (
                <>
                    <DataCell.Action icon={Pencil} title="Editar" onClick={() => { setCurrentCategory(item); setIsModalOpen(true) }} />
                    <DataCell.Action icon={Trash2} title="Eliminar" className="text-destructive" onClick={() => handleDelete(item.id)} />
                </>
            ),
        }),
    ], [])

    const bulkActions = useMemo<BulkAction<UoMCategory>[]>(() => [
        {
            key: "delete",
            label: "Eliminar",
            icon: Trash2,
            intent: "destructive",
            onClick: async (items) => {
                if (!confirm(`¿Está seguro de que desea eliminar ${items.length} categorías de unidades?`)) return
                try {
                    await Promise.all(items.map(c => api.delete(`/inventory/uom-categories/${c.id}/`)))
                    toast.success(`${items.length} categorías eliminadas`)
                    refetch()
                } catch (error) {
                    showApiError(error, "Error al eliminar las categorías (pueden tener unidades asociadas)")
                }
            },
        },
    ], [])


    return (
        <div className="space-y-4">
            <DataTable
                columns={columns}
                data={filterFn(categories)}
                isLoading={isLoading}
                variant="embedded"
                leftAction={<SmartSearchBar searchDef={uomCategorySearchDef} placeholder="Buscar categoría..." />}
                pageSizeOptions={[10, 20]}
                bulkActions={bulkActions}
                createAction={createAction}
            />

            <UoMCategoryForm
                open={isModalOpen || !!externalOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        handleCloseModal()
                    } else {
                        setIsModalOpen(true)
                    }
                }}
                initialData={currentCategory.id ? currentCategory : undefined}
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
        </div>
    )
}
