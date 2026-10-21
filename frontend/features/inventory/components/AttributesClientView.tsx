"use client"

import { showApiError } from "@/lib/errors"

import React, { useCallback, useMemo } from "react"
import { Archive, ArchiveRestore } from "lucide-react"
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
        archiveAttribute,
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

    const archiveConfirm = useConfirmAction<Attribute>(async (attribute) => {
        const isArchiving = attribute.is_active
        try {
            await archiveAttribute({ id: attribute.id, is_active: !attribute.is_active })
            toast.success(`Atributo ${isArchiving ? "archivado" : "restaurado"}`)
        } catch (error) {
            showApiError(error, `Error al ${isArchiving ? "archivar" : "restaurar"}`)
        }
    })

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
        onArchive: (attribute) => archiveConfirm.requestConfirm(attribute),
    }

    const bulkArchiveConfirm = useConfirmAction<Attribute[]>(async (items) => {
        const isArchiving = items.every(a => a.is_active)
        try {
            await Promise.all(items.map(a => archiveAttribute({ id: a.id, is_active: !isArchiving })))
            toast.success(`${items.length} atributos ${isArchiving ? "archivados" : "restaurados"}`)
        } catch (error) {
            showApiError(error, `Error al ${isArchiving ? "archivar" : "restaurar"} los atributos`)
            throw error
        }
    })

    const bulkActions = useMemo<BulkAction<Attribute>[]>(() => [
        {
            key: "restore",
            label: "Restaurar",
            icon: ArchiveRestore,
            intent: "success",
            hidden: (items) => items.length === 0 || !items.every(a => !a.is_active),
            onClick: async (items) => bulkArchiveConfirm.requestConfirm(items),
        },
        {
            key: "archive",
            label: "Archivar",
            icon: Archive,
            intent: "destructive",
            hidden: (items) => items.length === 0 || !items.every(a => a.is_active),
            onClick: async (items) => bulkArchiveConfirm.requestConfirm(items),
        },
    ], [bulkArchiveConfirm])

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
                open={archiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) archiveConfirm.cancel() }}
                onConfirm={archiveConfirm.confirm}
                title={archiveConfirm.payload?.is_active ? "Archivar Atributo" : "Restaurar Atributo"}
                description={archiveConfirm.payload?.is_active
                    ? "¿Seguro que deseas archivar este atributo? Dejará de estar disponible para nuevas variantes."
                    : "¿Seguro que deseas restaurar este atributo?"}
                variant={archiveConfirm.payload?.is_active ? "warning" : "default"}
                confirmText={archiveConfirm.payload?.is_active ? "Archivar" : "Restaurar"}
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
                open={bulkArchiveConfirm.isOpen}
                onOpenChange={(open) => { if (!open) bulkArchiveConfirm.cancel() }}
                onConfirm={bulkArchiveConfirm.confirm}
                title={bulkArchiveConfirm.payload?.every(a => a.is_active) ? "Archivar Atributos" : "Restaurar Atributos"}
                description={`¿Está seguro de que desea ${bulkArchiveConfirm.payload?.every(a => a.is_active) ? "archivar" : "restaurar"} ${bulkArchiveConfirm.payload?.length ?? 0} atributos?`}
                variant={bulkArchiveConfirm.payload?.every(a => a.is_active) ? "warning" : "default"}
                confirmText={bulkArchiveConfirm.payload?.every(a => a.is_active) ? "Archivar" : "Restaurar"}
            />
        </div>
    )
}
