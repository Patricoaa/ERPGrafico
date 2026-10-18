"use client"

import { showApiError } from "@/lib/errors"

import React, { useCallback, useMemo } from "react"
import { Trash2 } from "lucide-react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { ActionConfirmModal, UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch, type BulkAction } from "@/components/shared"
import { Collection, useCollectionViewMode, useEntityCollection } from "@/components/entity-view"
import { useConfirmAction } from "@/hooks/useConfirmAction"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { useAttributes, type Attribute } from "@/features/inventory/hooks/useAttributes"
import { attributeUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { attributeEntity, attributeViews } from "../entity-view/attribute.entity"
import { attributeActions, type AttributeActionsCtx } from "./attributeActions"
import { AttributeValuesProvider } from "./AttributeValuesSummary"
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
        isError,
        refetch,
        deleteAttribute,
        deleteAttributeValue,
    } = useAttributes({ filters: search.filters })
    const { view, onViewChange } = useCollectionViewMode("inventory.attribute")
    const collection = useEntityCollection(
        attributeEntity,
        { rows: attributes, isLoading, error: isError, refetch, isFiltered: search.isFiltered },
        { defaultSort: attributeViews.table.defaultSort },
    )

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
            <AttributeValuesProvider
                value={{
                    onDeleteValue: (valueId) => handleDeleteValue(valueId),
                    onAddValue: (attributeId) => openSelected(attributeId),
                }}
            >
                <Collection.Root
                    collection={collection}
                    selection="bulk"
                    view={view}
                    onViewChange={onViewChange}
                    onOpen={(attr) => openSelected(attr.id)}
                    actions={attributeActions.forCollection(attributeActionsCtx)}
                >
                    <Collection.Toolbar action={createAction}>
                        <UnifiedSearchBar
                            config={attributeUnifiedSearchDef}
                            {...bindUnifiedSearch(search)}
                            placeholder="Buscar atributo..."
                        />
                    </Collection.Toolbar>
                    <Collection.View
                        table={attributeViews.table}
                        card={attributeViews.card}
                        emptyTitle="Aún no hay atributos"
                        emptyDescription="Crea atributos (color, talla…) para generar variantes de producto."
                        emptyAction={createAction}
                        onResetFilters={search.clearAll}
                    />
                    <Collection.BulkBar actions={bulkActions} />
                </Collection.Root>
            </AttributeValuesProvider>

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
