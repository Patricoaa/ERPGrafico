"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { DataTableView, AutoEntityCard } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { documentUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { useInventoryDocuments, useInventoryDocumentMutations } from "../hooks/useInventoryDocuments"
import { InventoryDocumentDrawer } from "./InventoryDocumentDrawer"
import { documentActions, type InventoryDocumentActionsCtx } from "../documentActions"
import type { InventoryDocument } from "../types"
import { inventoryDocumentFields } from "../inventoryDocumentFields"
import { toast } from "sonner"
import React from "react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { showApiError } from "@/lib/errors"
import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared"

interface DocumentsClientViewProps {
    documentTypeFilter?: 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT' | 'PRODUCTION'
    createAction?: React.ReactNode
}

export function DocumentsClientView({ documentTypeFilter, createAction }: DocumentsClientViewProps) {
    const search = useUnifiedSearch(documentUnifiedSearchDef)
    const allFilters = useMemo(() => ({
        ...search.filters,
        ...(documentTypeFilter ? { document_type: documentTypeFilter } : {})
    }), [search.filters, documentTypeFilter])

    const isGrouping = search.groupBy !== null
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, documents, totalCount, isLoading, refetch } = useInventoryDocuments({
        ...allFilters,
        page: isGrouping ? 1 : pageState.pageIndex + 1,
        page_size: isGrouping ? 200 : pageState.pageSize,
    })

    const isOverLimit = isGrouping && totalCount > 200
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<InventoryDocument>({
        endpoint: '/inventory/documents'
    })

    const selectedDocumentId = selectedFromUrl?.id ?? null

    const handleCloseDrawer = () => {
        clearSelection()
    }

    const { openSelected } = useEntityRouteActions()

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

    const printRef = useRef<HTMLDivElement>(null)
    const handlePrint = useReactToPrint({ contentRef: printRef })

    const actionsCtx: InventoryDocumentActionsCtx = useMemo(() => ({
        onViewDetail: openSelected,
        onPrint: () => handlePrint(),
        onAnnul: handleAnnul,
    }), [openSelected, handlePrint, handleAnnul])

    const columns = useMemo<ColumnDef<InventoryDocument>[]>(() => {
        return [
            ...inventoryDocumentFields.toColumns({ exclude: documentTypeFilter ? ['documentType'] : [] }),
            documentActions.auto(actionsCtx),
        ]
    }, [documentTypeFilter, actionsCtx])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.inventorydocument"
                    columns={columns}
                    data={documents}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination={!effectiveGrouping}
                    pageCount={effectiveGrouping ? 1 : page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 200 } : pageState}
                    onPaginationChange={effectiveGrouping ? undefined : setPageState}
                    unifiedSearch={<UnifiedSearchBar
                        config={documentUnifiedSearchDef}
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
                        placeholder="Buscar documentos..."
                    />}
                    unifiedSearchConfig={documentUnifiedSearchDef}
                    currentGroupBy={effectiveGrouping ? search.groupBy : null}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    createAction={createAction}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "No se encontraron documentos",
                        description: "Los documentos de inventario registran y respaldan todas las transacciones físicas.",
                    }}
                    cardSkeleton={{ showFooter: false }}
                    renderCard={(doc: InventoryDocument) => (
                            <AutoEntityCard
                                key={doc.id}
                                data={doc}
                                fields={inventoryDocumentFields}

                                entityLabel="inventory.inventorydocument"

                                actions={documentActions.render(doc, actionsCtx)}
                                defaultAction={() => openSelected(doc.id)}
                            />
                    )}
                />
            </div>

            <PrintableLayout ref={printRef} title="Documento de Inventario" displayId={selectedDocumentId ? `DOC-${selectedDocumentId}` : ''}>
                <div className="text-4xs">Impresión de documento de inventario</div>
            </PrintableLayout>

            <InventoryDocumentDrawer
                documentId={selectedDocumentId}
                open={selectedDocumentId !== null}
                onOpenChange={(open) => {
                    if (!open) handleCloseDrawer()
                }}
                onSuccess={refetch}
            />
        </div>
    )
}
