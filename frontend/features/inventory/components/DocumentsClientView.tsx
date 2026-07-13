"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Chip, DataTableView, StatusBadge } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell, EntityCard } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { documentUnifiedSearchDef } from "@/features/inventory/unifiedSearchDef"
import { useInventoryDocuments, useInventoryDocumentMutations } from "../hooks/useInventoryDocuments"
import { InventoryDocumentDrawer } from "./InventoryDocumentDrawer"
import { documentActions, type InventoryDocumentActionsCtx } from "../documentActions"
import type { InventoryDocument } from "../types"
import { toast } from "sonner"
import React from "react"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { showApiError } from "@/lib/errors"
import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { PrintableLayout } from "@/features/_shared"

interface DocumentsClientViewProps {
    documentTypeFilter?: 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT' | 'PRODUCTION'
    createAction?: React.ReactNode
}

const DOCUMENT_TYPE_MAP: Record<string, { intent: "success" | "warning" | "neutral" | "info" | "primary", label: string }> = {
    'RECEIPT': { intent: 'success', label: 'Recepción' },
    'DELIVERY': { intent: 'primary', label: 'Entrega' },
    'TRANSFER': { intent: 'info', label: 'Transferencia' },
    'ADJUSTMENT': { intent: 'warning', label: 'Ajuste' },
    'PRODUCTION': { intent: 'neutral', label: 'Producción' }
}

export function DocumentsClientView({ documentTypeFilter, createAction }: DocumentsClientViewProps) {
    const pathname = usePathname()
    const router = useRouter()

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
        page_size: isGrouping ? 5000 : pageState.pageSize,
    })

    const isOverLimit = isGrouping && totalCount > 5000
    const effectiveGrouping = isGrouping && !isOverLimit

    useEffect(() => {
        if (isOverLimit) {
            toast.warning(`Demasiados datos para agrupar (${totalCount} registros). Use filtros para reducir el conjunto.`)
        }
    }, [isOverLimit, totalCount])

    const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<InventoryDocument>({
        endpoint: '/inventory/documents'
    })

    useEffect(() => {
        if (selectedFromUrl) {
            requestAnimationFrame(() => {
                setSelectedDocumentId(selectedFromUrl.id)
            })
        } else {
            requestAnimationFrame(() => {
                setSelectedDocumentId(null)
            })
        }
    }, [selectedFromUrl])

    const handleCloseDrawer = () => {
        setSelectedDocumentId(null)
        clearSelection()
    }

    const openSelected = useCallback((id: number) => {
        const params = new URLSearchParams()
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }, [router, pathname])

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
        const cols: ColumnDef<InventoryDocument>[] = [
            {
                id: "folio",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
                cell: ({ row }) => (
                    <DataCell.Code>{`DOC-${row.original.id}`}</DataCell.Code>
                ),
                size: 90,
            },
            {
                accessorKey: "date",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />,
                cell: ({ row }) => (
                    <DataCell.Date value={row.original.date} />
                ),
                size: 90,
            },
        ]

        if (!documentTypeFilter) {
            cols.push({
                accessorKey: "document_type",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
                cell: ({ row }) => {
                    const config = DOCUMENT_TYPE_MAP[row.original.document_type] || { intent: 'neutral' as const, label: row.original.document_type }
                    return (
                        <DataCell.Chip intent={config.intent} size="sm">{config.label}</DataCell.Chip>
                    )
                },
                size: 120,
            })
        }

        cols.push({
            id: "reference",
            header: ({ column }) => <DataTableColumnHeader column={column} title="Referencia" className="justify-center" />,
            cell: ({ row }) => {
                const doc = row.original
                if (doc.source_document_type && doc.source_document_id) {
                    return <DataCell.Entity entityLabel={doc.source_document_type} number={doc.source_document_id} />
                }
                return <DataCell.Text>{doc.reference || '-'}</DataCell.Text>
            },
            size: 120,
        })

        cols.push(
            {
                accessorKey: "status",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
                cell: ({ row }) => (
                    <DataCell.Status status={row.original.status} />
                ),
                size: 100,
            },
            documentActions.column(actionsCtx),
        )

        return cols
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
                    pagination={effectiveGrouping ? { pageIndex: 0, pageSize: 5000 } : pageState}
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
                    renderCard={(doc: InventoryDocument) => {
                        const typeConfig = DOCUMENT_TYPE_MAP[doc.document_type] || { intent: 'neutral' as const, label: doc.document_type }
                        return (
                            <EntityCard
                                key={doc.id}
                                onClick={() => openSelected(doc.id)}
                            >
                                <EntityCard.Header
                                    title={doc.partner_name ?? doc.reference ?? `Documento #${doc.id}`}
                                    subtitle={doc.date}
                                />
                                <EntityCard.Body>
                                    <EntityCard.Field label="Tipo" value={<Chip intent={typeConfig.intent} size="sm">{typeConfig.label}</Chip>} />
                                    <EntityCard.Field label="Estado" value={<StatusBadge status={doc.status} size="sm" />} />
                                    {doc.reference && <EntityCard.Field label="Referencia" value={doc.reference} />}
                                </EntityCard.Body>
                            </EntityCard>
                        )
                    }}
                />
            </div>

            <PrintableLayout ref={printRef} title="Documento de Inventario" displayId={selectedDocumentId ? `DOC-${selectedDocumentId}` : ''}>
                <div className="text-[9px]">Impresión de documento de inventario</div>
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
