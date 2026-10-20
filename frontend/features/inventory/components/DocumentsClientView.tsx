"use client"

import React, { useEffect, useCallback } from "react"
import { Collection, useCollectionViewMode, useEntityCollection, useServerPage, GROUP_ROW_LIMIT, type FieldId } from "@/components/entity-view"
import { UnifiedSearchBar, bindUnifiedSearch, useUnifiedSearch } from '@/components/shared'
import { documentUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { useInventoryDocuments, useInventoryDocumentMutations } from "../hooks/useInventoryDocuments"
import { documentActions, type InventoryDocumentActionsCtx } from "../documentActions"
import type { InventoryDocument } from "../types"
import { inventoryDocumentEntity, inventoryDocumentViews } from "../entity-view/inventoryDocument.entity"
import { toast } from "sonner"
import { useDocumentSheetRoute } from "@/hooks/useDocumentSheetRoute"
import { showApiError } from "@/lib/errors"

interface DocumentsClientViewProps {
    documentTypeFilter?: 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT' | 'PRODUCTION' | 'PARTNER_CONTRIBUTION' | 'PARTNER_WITHDRAWAL'
    createAction?: React.ReactNode
}

/** Search group keys → entity field ids (grouping uses the formatted cell text). */
const DOCUMENT_GROUPS: Record<string, FieldId<typeof inventoryDocumentEntity.fields>> = { date: "date", document_type: "documentType", status: "status" }
const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

export function DocumentsClientView({ documentTypeFilter, createAction }: DocumentsClientViewProps) {
    const search = useUnifiedSearch(documentUnifiedSearchDef)
    const allFilters = React.useMemo(() => ({
        ...search.filters,
        ...(documentTypeFilter ? { document_type: documentTypeFilter } : {})
    }), [search.filters, documentTypeFilter])

    const groupBy = search.groupBy ? DOCUMENT_GROUPS[search.groupBy] ?? null : null
    const [pageState, setPageState] = useServerPage([allFilters, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("inventory.inventorydocument")

    const { documents, totalCount, isLoading, isRefetching, isError, refetch } = useInventoryDocuments({
        ...allFilters,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    })

    const isTruncated = !!groupBy && totalCount > GROUP_ROW_LIMIT

    useEffect(() => {
        if (isTruncated) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isTruncated, totalCount])

    const sheet = useDocumentSheetRoute("inventory.inventorydocument")

    const { annulDocument } = useInventoryDocumentMutations()

    const handleAnnul = useCallback(async (doc: InventoryDocument) => {
        try {
            await annulDocument(doc.id)
            toast.success("Documento anulado con éxito.")
            refetch()
        } catch (error) {
            showApiError(error, "Error al anular documento")
        }
    }, [annulDocument, refetch])

    const actionsCtx: InventoryDocumentActionsCtx = React.useMemo(() => ({
        onViewDetail: sheet.toggle,
        onPrint: (doc) => sheet.toggle(doc.id),
        onAnnul: handleAnnul,
    }), [sheet, handleAnnul])

    const collection = useEntityCollection(
        inventoryDocumentEntity,
        { rows: documents, rowCount: totalCount, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState }, groupBy },
    )

    const table = documentTypeFilter ? inventoryDocumentViews.table.without("documentType") : inventoryDocumentViews.table

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(doc) => sheet.toggle(doc.id)}
                view={view}
                onViewChange={onViewChange}
                actions={documentActions.forCollection(actionsCtx)}
            >
                <Collection.Toolbar action={createAction}>
                    <UnifiedSearchBar config={documentUnifiedSearchDef} {...bindUnifiedSearch(search)} placeholder="Buscar documentos..." />
                </Collection.Toolbar>
                <Collection.View
                    table={table}
                    card={inventoryDocumentViews.card}
                    emptyTitle="No se encontraron documentos"
                    emptyDescription="Los documentos de inventario registran y respaldan todas las transacciones físicas."
                    emptyAction={createAction}
                    onResetFilters={search.clearAll}
                />
            </Collection.Root>
        </div>
    )
}
