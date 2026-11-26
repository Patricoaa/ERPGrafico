"use client"

import React, { useEffect, useCallback } from "react"
import { Collection, useCollectionQuery, useCollectionViewMode, useEntityCollection, useServerPage, GROUP_ROW_LIMIT } from "@/components/entity-view"
import { useInventoryDocuments, useInventoryDocumentMutations } from "../hooks/useInventoryDocuments"
import { useInventoryDocumentGroups } from "../hooks/useInventoryGroups"
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

const DEFAULT_PAGE = { pageIndex: 0, pageSize: 50 }

export function DocumentsClientView({ documentTypeFilter, createAction }: DocumentsClientViewProps) {
    const query = useCollectionQuery(inventoryDocumentEntity)
    const { search, groupBy, groupKey } = query
    // A route per document type fixes it (the "Tipo" filter then has no effect there).
    const allFilters = React.useMemo(() => ({
        ...query.params,
        ...(documentTypeFilter ? { document_type: documentTypeFilter } : {})
    }), [query.params, documentTypeFilter])
    const [pageState, setPageState] = useServerPage([allFilters, groupBy], DEFAULT_PAGE)
    const { view, onViewChange } = useCollectionViewMode("inventory.inventorydocument")

    // Grouping by a field with a server key groups the whole result (`groups/`, ADR-0158 §7).
    const grouped = useInventoryDocumentGroups({ groupKey, filters: allFilters })
    const list = useInventoryDocuments({
        ...allFilters,
        page: groupBy ? 1 : pageState.pageIndex + 1,
        page_size: groupBy ? GROUP_ROW_LIMIT : pageState.pageSize,
    }, groupKey === null)
    const { documents, totalCount } = list
    const { isLoading, isRefetching, isError, refetch } = groupKey ? grouped : list

    // Only the page grouping is bounded; server groups cover the whole result.
    const isTruncated = !!groupBy && !groupKey && totalCount > GROUP_ROW_LIMIT

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
        onPrint: (doc) => sheet.toggle(doc.id, doc),
        onAnnul: handleAnnul,
    }), [sheet, handleAnnul])

    const collection = useEntityCollection(
        inventoryDocumentEntity,
        { rows: documents, rowCount: totalCount, isLoading, isRefetching, error: isError, refetch, isFiltered: search.isFiltered },
        { pagination: groupBy ? { mode: "none" } : { mode: "server", state: pageState, onChange: setPageState }, groupBy, serverGroups: grouped.groups },
    )

    const table = documentTypeFilter ? inventoryDocumentViews.table.without("documentType") : inventoryDocumentViews.table

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <Collection.Root
                collection={collection}
                selection="panel"
                selectedId={sheet.selectedId ?? null}
                onOpen={(doc) => sheet.toggle(doc.id, doc)}
                view={view}
                onViewChange={onViewChange}
                actions={documentActions.forCollection(actionsCtx)}
                query={query}
            >
                <Collection.Toolbar action={createAction} />
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
