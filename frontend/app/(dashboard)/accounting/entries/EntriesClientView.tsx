"use client"

import React, { useEffect, useState, useRef, useMemo } from "react"
import {
    ColumnDef,
} from "@tanstack/react-table"

import { toast } from "sonner"
import { JournalEntryDrawer } from "@/features/accounting/components/JournalEntryDrawer"
import api from "@/lib/api"

import { CheckCircle, RotateCcw, FileText } from "lucide-react"
import { DataTableView, DataTableColumnHeader } from '@/components/shared'
import { DataCell, createActionsColumn, Chip } from '@/components/shared'
import Link from "next/link"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { useJournalEntries, type JournalEntry } from "@/features/accounting/hooks/useJournalEntries"
import { useAccountingAccounts } from "@/features/accounting/hooks/useAccounts"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"
import { SmartSearchBar, useSmartSearch } from "@/components/shared"
import { journalEntrySearchDef } from "@/features/accounting/searchDef"

interface EntriesPageProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
    createAction?: React.ReactNode
}

export default function EntriesPage({ externalOpen, onExternalOpenChange, createAction }: EntriesPageProps) {
    const { filters } = useSmartSearch(journalEntrySearchDef)
    const { entries, isLoading, refetch } = useJournalEntries(filters)
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
        setEditingEntry(selectedFromUrl)
        setIsFormOpen(true)
        setViewingTransaction(null)
    }, [selectedFromUrl])

    // ?detail=<id> → abre el visor de transacción (read-only)
    useEffect(() => {
        if (!detailId) return
        setViewingTransaction({ type: 'journal_entry', id: Number(detailId) })
        setIsFormOpen(false)
        setEditingEntry(null)
    }, [detailId])

    const clearSelection = () => {
        clearActions()
    }

    const handleCloseModal = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`)
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
            clearSelection()
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
        createActionsColumn<JournalEntry>({
            renderActions: (entry) => (
                <>
                    {entry.status === 'DRAFT' ? (
                        <DataCell.Action action="edit" onClick={() => openSelected(entry.id)} />
                    ) : (
                        <DataCell.Action action="detail" onClick={() => openDetail(entry.id)} />
                    )}
                    {entry.status === 'DRAFT' && (
                        <DataCell.Action
                            icon={CheckCircle}
                            title="Publicar"
                            onClick={() => handlePost(entry.id)}
                        />
                    )}
                    {entry.status === 'DRAFT' && (
                        <DataCell.Action
                            action="delete"
                            onClick={() => handleDelete(entry.id)}
                        />
                    )}
                    {(entry.status === 'POSTED' || entry.status === 'CLOSED') && entry.is_manual && (
                        <DataCell.Action
                            icon={RotateCcw}
                            title="Reversar"
                            onClick={() => handleReverse(entry.id)}
                        />
                    )}
                </>
            )
        }),
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
                    leftAction={<SmartSearchBar searchDef={journalEntrySearchDef} placeholder="Buscar asientos..." className="w-full" />}
                    defaultPageSize={20}
                    createAction={createAction}
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
