"use client"

import { showApiError } from "@/lib/errors"

import React, { useState, useMemo, useCallback } from "react"
import { Trash2, Tag } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { DataTableView, AutoEntityCard } from '@/components/shared'
import { attributeActions, type AttributeActionsCtx } from './attributeActions'
import { type ColumnDef } from "@tanstack/react-table"
import { Checkbox } from "@/components/ui/checkbox"
import type { BulkAction } from "@/components/shared"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { ActionConfirmModal } from "@/components/shared"
import { attributeFields } from "../attributeFields"
import { AttributeValuesProvider } from "./AttributeValuesSummary"
import { useAttributes, type Attribute } from "@/features/inventory/hooks/useAttributes"
import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { attributeUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { AttributeDrawer } from "./AttributeDrawer"

interface AttributesClientViewProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export function AttributesClientView({ externalOpen, onExternalOpenChange, createAction }: AttributesClientViewProps) {
    const search = useUnifiedSearch(attributeUnifiedSearchDef)
    const {
        attributes,
        isLoading,
        refetch,
        deleteAttribute,
        deleteAttributeValue,
    } = useAttributes({ filters: search.filters })

    const searchParams = useSearchParams()
    const router = useRouter()
    const pathname = usePathname()

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Attribute>({
        endpoint: '/inventory/attributes'
    })
    const { openSelected } = useEntityRouteActions()

    const isCreateOpen = searchParams.get("modal") === "new" || externalOpen
    const isEditOpen = !!selectedFromUrl
    const drawerOpen = Boolean(isCreateOpen || isEditOpen)

    const handleCloseModal = (open: boolean = false) => {
        if (!open) {
            onExternalOpenChange?.(false)
            if (isEditOpen) clearSelection()
            if (isCreateOpen) {
                const params = new URLSearchParams(searchParams.toString())
                params.delete("modal")
                router.replace(`${pathname}?${params.toString()}`, { scroll: false })
            }
        }
    }

    const deleteAttrConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteAttribute(id)
            toast.success("Atributo eliminado")
        } catch (error) {
            showApiError(error, "Error al eliminar")
        }
    })

    const handleDeleteAttribute = useCallback((id: number) => deleteAttrConfirm.requestConfirm(id), [deleteAttrConfirm])

    const deleteValueConfirm = useConfirmAction<number>(async (id) => {
        try {
            await deleteAttributeValue(id)
            toast.success("Valor eliminado")
        } catch (error) {
            showApiError(error, "Error al eliminar valor")
        }
    })

    const handleDeleteValue = useCallback((id: number) => deleteValueConfirm.requestConfirm(id), [deleteValueConfirm])

    const attributeActionsCtx: AttributeActionsCtx = {
        onEdit: (id) => openSelected(id),
        onDelete: (id) => handleDeleteAttribute(id),
    }

    const bulkDeleteConfirm = useConfirmAction<Attribute[]>(async (items) => {
        try {
            await Promise.all(items.map(a => deleteAttribute(a.id)))
            toast.success(`${items.length} atributos eliminados`)
        } catch (error) {
            showApiError(error, "Error al eliminar los atributos")
            throw error
        }
    })

    const columns = useMemo<ColumnDef<Attribute>[]>(() => [
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
        ...attributeFields.toColumns(),
        attributeActions.auto(attributeActionsCtx),
    ], [attributeActionsCtx])

    const bulkActions = useMemo<BulkAction<Attribute>[]>(() => [
        {
            key: "delete",
            label: "Eliminar",
            icon: Trash2,
            intent: "destructive",
            onClick: async (items) => bulkDeleteConfirm.requestConfirm(items),
        },
    ], [bulkDeleteConfirm])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <AttributeValuesProvider
                    value={{
                        onDeleteValue: (valueId) => handleDeleteValue(valueId),
                        onAddValue: (attributeId) => openSelected(attributeId),
                    }}
                >
                <DataTableView
                    entityLabel="inventory.attribute"
                    columns={columns}
                    data={attributes}
                    isLoading={isLoading}
                    variant="embedded"
                    bulkActions={bulkActions}
                    createAction={createAction}
                    unifiedSearch={<UnifiedSearchBar
                        config={attributeUnifiedSearchDef}
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
                        placeholder="Buscar atributo..."
                    />}
                    unifiedSearchConfig={attributeUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "Aún no hay atributos",
                        description: "Crea atributos (color, talla…) para generar variantes de producto.",
                    }}
                    renderCard={(attr: Attribute) => (
                        <AutoEntityCard
                            key={attr.id}
                            data={attr}
                            fields={attributeFields}
                            entityLabel="inventory.attribute"
                            icon={Tag}
                            actions={attributeActions.render(attr, attributeActionsCtx)}
                        />
                    )}
                />
                </AttributeValuesProvider>
            </div>

            <AttributeDrawer
                onSuccess={() => { void refetch() }}
                open={drawerOpen}
                onOpenChange={handleCloseModal}
                initialData={selectedFromUrl || undefined}
            />

            <ActionConfirmModal
                open={deleteAttrConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteAttrConfirm.cancel() }}
                onConfirm={deleteAttrConfirm.confirm}
                title="Eliminar Atributo"
                description="¿Seguro que deseas eliminar este atributo y todos sus valores?"
                variant="destructive"
            />

            <ActionConfirmModal
                open={deleteValueConfirm.isOpen}
                onOpenChange={(open) => { if (!open) deleteValueConfirm.cancel() }}
                onConfirm={deleteValueConfirm.confirm}
                title="Eliminar Valor de Atributo"
                description="¿Seguro que deseas eliminar este valor?"
                variant="destructive"
            />

            <ActionConfirmModal
                open={bulkDeleteConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkDeleteConfirm.cancel() }}
                onConfirm={bulkDeleteConfirm.confirm}
                title="Eliminar Atributos"
                description={`¿Está seguro de que desea eliminar ${bulkDeleteConfirm.payload?.length ?? 0} atributos y todos sus valores?`}
                variant="destructive"
            />
        </div>
    )
}
