"use client"

import React, { useEffect, useState, useRef, useMemo } from "react"
import {
    ColumnDef,
} from "@tanstack/react-table"

import { toast } from "sonner"
import { JournalEntryDrawer } from "@/features/accounting"
import api from "@/lib/api"

import { DataTableView, DataTableColumnHeader, EntityCard } from '@/components/shared'
import { DataCell, Chip } from '@/components/shared'
import { FileEdit, RotateCcw, FileText } from "lucide-react"
import { journalEntryActions, type JournalEntryActionsCtx } from './journalEntryActions'
import { resolveStatus } from '@/lib/badge-resolvers'

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useJournalEntries, type JournalEntry } from "@/features/accounting"
import { useAccountingAccounts } from "@/features/accounting"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { SmartSearchBar, useSmartSearch, SegmentationBar, useSegmentation } from "@/components/shared"
import { journalEntrySearchDef } from "@/features/accounting/searchDef"
import { journalEntrySegDef } from "@/features/accounting/segmentationDef"

interface EntriesPageProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export default function EntriesPage({ externalOpen, onExternalOpenChange, createAction }: EntriesPageProps) {
    const { filters: textFilters, isFiltered: isTextFiltered, clearAll: clearText } = useSmartSearch(journalEntrySearchDef)
    const basePeriod = { serverParamFrom: 'date_after', serverParamTo: 'date_before' }
    const { filters: segFilters, isFiltered: isSegFiltered, clearAll: clearSeg } = useSegmentation(journalEntrySegDef, basePeriod)
    const isFiltered = isTextFiltered || isSegFiltered
    const allFilters = { ...textFilters, ...segFilters }
    const { entries, isLoading, refetch } = useJournalEntries(allFilters)
    const { accounts } = useAccountingAccounts({ filters: { is_leaf: true } })
    const [viewingTransaction, setViewingTransaction] = useState<{ type: 'journal_entry', id: number | string } | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)

    // Guard for async operations
    const isMounted = useRef(true)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const { entity: selectedFromUrl } = useSelectedEntity<JournalEntry>({
        endpoint: '/accounting/entries'
    })
    const { detailId, openSelected, openDetail, clearActions } = useEntityRouteActions()

    // ?selected=<id> → abre el form de edición
    useEffect(() => {
        if (!selectedFromUrl) return
        requestAnimationFrame(() => {
            setEditingEntry(selectedFromUrl)
            setIsFormOpen(true)
            setViewingTransaction(null)
        })
    }, [selectedFromUrl])

    // ?detail=<id> → abre el visor de transacción (read-only)
    useEffect(() => {
        if (!detailId) return
        requestAnimationFrame(() => {
            setViewingTransaction({ type: 'journal_entry', id: Number(detailId) })
            setIsFormOpen(false)
            setEditingEntry(null)
        })
    }, [detailId])

    const clearSelection = () => {
        clearActions()
    }

    // Initialize/Cleanup mount guard
    useEffect(() => {
        isMounted.current = true
        return () => { isMounted.current = false }
    }, [])

    // Synchronize external modal trigger (guard against repeated opens)
    const didOpenExternal = useRef(false)
    useEffect(() => {
        if (externalOpen && !didOpenExternal.current) {
            didOpenExternal.current = true
            setIsFormOpen(true)
        }
        if (!externalOpen) {
            didOpenExternal.current = false
        }
    }, [externalOpen])

    const handleFormOpenChange = (open: boolean) => {
        setIsFormOpen(open)
        if (!open) {
            setEditingEntry(null)
            onExternalOpenChange?.(false)
            // Clean all action params + modal so URL doesn't stay ?modal=new forever
            const params = new URLSearchParams(searchParams.toString())
            let changed = false
            for (const p of ['selected', 'detail', 'hub', 'modal'] as const) {
                if (params.has(p)) { params.delete(p); changed = true }
            }
            if (changed) {
                const query = params.toString()
                router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
            }
        }
    }

    const handlePost = async (id: number) => {
        try {
            await api.post(`/accounting/entries/${id}/post_entry/`)
            toast.success("Asiento publicado exitosamente")
            refetch()
        } catch (error) {
            console.error("Error posting entry:", error)
            toast.error("Error al publicar el asiento")
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar este asiento?")) return
        try {
            await api.delete(`/accounting/entries/${id}/`)
            toast.success("Asiento eliminado exitosamente")
            refetch()
        } catch (error) {
            console.error("Error deleting entry:", error)
            toast.error("Error al eliminar el asiento")
        }
    }

    const handleReverse = async (id: number) => {
        if (!confirm("¿Está seguro de reversar este asiento? Se creará un asiento de reversión.")) return
        try {
            await api.post(`/accounting/entries/${id}/reverse_entry/`)
            toast.success("Asiento de reversión creado exitosamente")
            refetch()
        } catch (error) {
            console.error("Error reversing entry:", error)
            toast.error("Error al reversar el asiento")
        }
    }

    const journalEntryActionsCtx: JournalEntryActionsCtx = {
        onEdit: (id) => openSelected(id),
        onDetail: (id) => openDetail(id),
        onPublish: (id) => handlePost(id),
        onDelete: (id) => handleDelete(id),
        onReverse: (id) => handleReverse(id),
    }

    const columns: ColumnDef<JournalEntry>[] = useMemo(() => [
        {
            accessorKey: "display_id",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" className="justify-center" />
            ),
            cell: ({ row }) => <DataCell.Code>{row.getValue("display_id")}</DataCell.Code>,
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.Date value={row.getValue("date")} />
                </div>
            ),
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción" className="justify-center" />
            ),
            cell: ({ row }) => (
                <DataCell.Text>
                    <span className="truncate max-w-[300px]">{row.getValue("description")}</span>
                </DataCell.Text>
            )
        },
        {
            accessorKey: "status",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" className="justify-center" />
            ),
            cell: ({ row }) =>
                <DataCell.Status status={row.getValue("status")} />,
        },
        {
            id: "origin",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Origen" className="justify-center" />
            ),
            cell: ({ row }) => {
                const entry = row.original
                if (entry.is_manual) return <Chip size="sm" intent="neutral">Manual</Chip>
                if (entry.reversal_of) return <Chip size="sm" intent="warning">Reversión</Chip>
                return <Chip size="sm" intent="info">Automático</Chip>
            },
            enableSorting: false,
        },
        journalEntryActions.column(journalEntryActionsCtx),
    ], [openSelected, openDetail, handlePost, handleDelete, handleReverse])


    return (
        <div className="h-full flex flex-col">
            <div className="pt-2 flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={entries}
                    isLoading={isLoading}
                    entityLabel="accounting.journalentry"
                    variant="embedded"
                    smartSearch={<SmartSearchBar searchDef={journalEntrySearchDef} placeholder="Buscar asientos..." className="w-full" />}
                    segmentation={<SegmentationBar def={journalEntrySegDef} basePeriod={basePeriod} />}
                    showReset={isFiltered}
                    onReset={() => { clearText(); clearSeg() }}
                    defaultPageSize={20}
                    createAction={createAction}
                    isFiltered={isFiltered}
                    emptyState={{
                        context: "finance",
                        title: "Aún no hay asientos contables",
                        description: "Los asientos se registran al confirmar operaciones o puedes crear uno manualmente.",
                    }}
                    cardGroupBy={{
                        field: 'date',
                        sort: 'desc',
                        aggregators: [
                            { key: 'count', label: 'Asientos', fn: 'count', format: 'integer' },
                        ],
                    }}
                    onRowClick={(m) => openDetail(m.id)}
                    renderCard={(m) => {
                        const Icon = m.is_manual ? FileEdit : m.reversal_of ? RotateCcw : FileText
                        const iconStyle = m.is_manual
                            ? "text-info bg-info/10"
                            : m.reversal_of
                                ? "text-warning bg-warning/10"
                                : "text-success bg-success/10"
                        const total = m.items?.reduce((sum: number, item) => sum + (Number(item.debit) || 0), 0) || 0
                        const originLabel = m.is_manual ? 'Manual' : m.reversal_of ? 'Reversión' : 'Automático'
                        const statusLabel = resolveStatus(m.status).label
                        return (
                            <EntityCard key={m.id} onClick={() => openDetail(m.id)}>
                                <EntityCard.Header
                                    icon={Icon}
                                    iconClassName={iconStyle}
                                    title={m.display_id}
                                    subtitle={
                                        <span className="text-xs text-muted-foreground/70">
                                            {statusLabel} · {originLabel}
                                        </span>
                                    }
                                    center={
                                        <span className="text-xs text-muted-foreground line-clamp-2 text-center max-w-[400px]">
                                            {m.description}
                                        </span>
                                    }
                                    trailing={<DataCell.Currency value={total} />}
                                />
                            </EntityCard>
                        )
                    }}
                    cardSkeleton={{ showBody: false }}
                />

                <JournalEntryDrawer
                    accounts={accounts as any}
                    initialData={editingEntry as unknown as import('@/types/forms').JournalEntryInitialData | undefined}
                    onSuccess={() => {
                        refetch()
                        handleFormOpenChange(false)
                    }}
                    open={isFormOpen}
                    onOpenChange={handleFormOpenChange}
                />

                {viewingTransaction && (
                    <JournalEntryDrawer
                        journalEntryId={Number(viewingTransaction.id)}
                        mode="view"
                        open={!!viewingTransaction}
                        onOpenChange={(open) => {
                            if (!open) {
                                setViewingTransaction(null)
                                clearSelection()
                            }
                        }}
                    />
                )}
            </div>
        </div>
    )
}
