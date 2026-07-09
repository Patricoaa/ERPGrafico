"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Chip, DataTableView } from '@/components/shared'
import { DataTableColumnHeader } from '@/components/shared'
import { DataCell, EntityCard } from '@/components/shared'
import { type ColumnDef } from "@tanstack/react-table"
import { SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from "@/components/shared"
import { useInventoryDocuments } from "../hooks/useInventoryDocuments"
import { InventoryDocumentDrawer } from "./InventoryDocumentDrawer"
import type { InventoryDocument } from "../types"
import type { SegmentDef } from "@/types/segmentation"
import React from "react"

interface DocumentsClientViewProps {
    documentTypeFilter?: 'RECEIPT' | 'DELIVERY' | 'TRANSFER' | 'ADJUSTMENT' | 'PRODUCTION'
}

const DOCUMENT_TYPE_MAP: Record<string, { intent: "success" | "warning" | "neutral" | "info" | "primary", label: string }> = {
    'RECEIPT': { intent: 'success', label: 'Recepción' },
    'DELIVERY': { intent: 'primary', label: 'Entrega' },
    'TRANSFER': { intent: 'info', label: 'Transferencia' },
    'ADJUSTMENT': { intent: 'warning', label: 'Ajuste' },
    'PRODUCTION': { intent: 'neutral', label: 'Producción' }
}

const STATUS_MAP: Record<string, { intent: "neutral" | "success" | "destructive" | "warning", label: string }> = {
    'DRAFT': { intent: 'neutral', label: 'Borrador' },
    'APPROVED': { intent: 'warning', label: 'Aprobado' },
    'CONFIRMED': { intent: 'success', label: 'Confirmado' },
    'CANCELLED': { intent: 'destructive', label: 'Anulado' }
}

const documentSearchDef = {
    fields: [
        { key: 'search', label: 'Buscar por Folio, referencia, contacto...', type: 'text' as const, serverParam: 'search' as const },
    ],
}

export function DocumentsClientView({ documentTypeFilter }: DocumentsClientViewProps) {
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const router = useRouter()

    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(documentSearchDef)
    const basePeriod = { serverParamFrom: 'date_from', serverParamTo: 'date_to' }

    // Dynamic segmentation depending on whether we filter by type or show all
    const documentSegDef = useMemo(() => {
        const segments: SegmentDef[] = [
            {
                key: 'status',
                label: 'Estado',
                type: 'tabs',
                serverParam: 'status',
                options: [
                    { value: '', label: 'Todos' },
                    { value: 'DRAFT', label: 'Borrador' },
                    { value: 'APPROVED', label: 'Aprobado' },
                    { value: 'CONFIRMED', label: 'Confirmado' },
                    { value: 'CANCELLED', label: 'Anulado' },
                ],
            }
        ]

        if (!documentTypeFilter) {
            segments.push({
                key: 'document_type',
                label: 'Tipo',
                type: 'tabs',
                serverParam: 'document_type',
                options: [
                    { value: '', label: 'Todos' },
                    { value: 'RECEIPT', label: 'Recepción' },
                    { value: 'DELIVERY', label: 'Entrega' },
                    { value: 'TRANSFER', label: 'Transferencia' },
                    { value: 'ADJUSTMENT', label: 'Ajuste' },
                    { value: 'PRODUCTION', label: 'Producción' },
                ],
            })
        }

        return { segments }
    }, [documentTypeFilter])

    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(documentSegDef, basePeriod)
    const isFiltered = isTextFiltered || isSegFiltered
    const allFilters = useMemo(() => ({ 
        ...textFilters, 
        ...segFilters,
        ...(documentTypeFilter ? { document_type: documentTypeFilter } : {})
    }), [textFilters, segFilters, documentTypeFilter])

    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 50 })
    const { page, documents, totalCount, isLoading, refetch } = useInventoryDocuments({
        ...allFilters,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })

    const [selectedDocumentId, setSelectedDocumentId] = useState<number | null>(null)

    useEffect(() => {
        const selectedId = searchParams.get('selected')
        if (selectedId) {
            setSelectedDocumentId(Number(selectedId))
        }
    }, [searchParams])

    const handleSelect = (id: number) => {
        setSelectedDocumentId(id)
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleCloseDrawer = () => {
        setSelectedDocumentId(null)
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
    }

    const columns = useMemo<ColumnDef<InventoryDocument>[]>(() => {
        const cols: ColumnDef<InventoryDocument>[] = [
            {
                id: "folio",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Folio" className="justify-center" />,
                cell: ({ row }) => (
                    <div className="flex flex-col items-center gap-0.5">
                        <DataCell.Code>{`#${row.original.id}`}</DataCell.Code>
                        <DataCell.Date value={row.original.date} />
                    </div>
                ),
                size: 100,
            },
            {
                accessorKey: "partner_name",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Contacto/Socio" className="justify-center" />,
                cell: ({ row }) => (
                    <div className="flex flex-col items-center py-1 w-full">
                        <DataCell.Text>{row.original.partner_name ?? '-'}</DataCell.Text>
                        {row.original.reference && (
                            <span className="text-[10px] text-muted-foreground font-mono">{row.original.reference}</span>
                        )}
                    </div>
                ),
            }
        ]

        if (!documentTypeFilter) {
            cols.push({
                accessorKey: "document_type",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Tipo" className="justify-center" />,
                cell: ({ row }) => {
                    const config = DOCUMENT_TYPE_MAP[row.original.document_type] || { intent: 'neutral' as const, label: row.original.document_type }
                    return (
                        <div className="flex justify-center w-full">
                            <Chip intent={config.intent} size="sm">{config.label}</Chip>
                        </div>
                    )
                },
                size: 120,
            })
        }

        cols.push(
            {
                accessorKey: "status",
                header: ({ column }) => <DataTableColumnHeader column={column} title="Estado" className="justify-center" />,
                cell: ({ row }) => {
                    const config = STATUS_MAP[row.original.status] || { intent: 'neutral' as const, label: row.original.status }
                    return (
                        <div className="flex justify-center w-full">
                            <Chip intent={config.intent} size="sm">{config.label}</Chip>
                        </div>
                    )
                },
                size: 100,
            },
            {
                id: "actions",
                header: () => null,
                cell: ({ row }) => (
                    <div className="flex justify-center w-full">
                        <button 
                            className="text-xs text-primary font-medium hover:underline"
                            onClick={() => handleSelect(row.original.id)}
                        >
                            Ver Detalles
                        </button>
                    </div>
                ),
                size: 100,
            }
        )

        return cols
    }, [documentTypeFilter])

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0">
                <DataTableView
                    entityLabel="inventory.inventorydocument"
                    columns={columns}
                    data={documents}
                    isLoading={isLoading}
                    variant="embedded"
                    manualPagination
                    pageCount={page ? Math.ceil(page.count / page.pageSize) : 0}
                    rowCount={totalCount}
                    pagination={pageState}
                    onPaginationChange={setPageState}
                    smartSearch={<SmartSearchBar searchDef={documentSearchDef} placeholder="Buscar documentos..." className="w-full" />}
                    segmentation={<SegmentationBar def={documentSegDef} basePeriod={basePeriod} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "inventory",
                        title: "No se encontraron documentos",
                        description: "Los documentos de inventario registran y respaldan todas las transacciones físicas.",
                    }}
                    renderCard={(doc: InventoryDocument) => {
                        const typeConfig = DOCUMENT_TYPE_MAP[doc.document_type] || { intent: 'neutral' as const, label: doc.document_type }
                        const statusConfig = STATUS_MAP[doc.status] || { intent: 'neutral' as const, label: doc.status }
                        return (
                            <EntityCard
                                key={doc.id}
                                onClick={() => handleSelect(doc.id)}
                            >
                                <EntityCard.Header
                                    title={doc.partner_name ?? doc.reference ?? `Documento #${doc.id}`}
                                    subtitle={doc.date}
                                />
                                <EntityCard.Body>
                                    <EntityCard.Field label="Tipo" value={<Chip intent={typeConfig.intent} size="sm">{typeConfig.label}</Chip>} />
                                    <EntityCard.Field label="Estado" value={<Chip intent={statusConfig.intent} size="sm">{statusConfig.label}</Chip>} />
                                    {doc.reference && <EntityCard.Field label="Referencia" value={doc.reference} />}
                                </EntityCard.Body>
                            </EntityCard>
                        )
                    }}
                />
            </div>

            {selectedDocumentId && (
                <InventoryDocumentDrawer
                    documentId={selectedDocumentId}
                    open={selectedDocumentId !== null}
                    onOpenChange={(open) => {
                        if (!open) handleCloseDrawer()
                    }}
                    onSuccess={refetch}
                />
            )}
        </div>
    )
}
