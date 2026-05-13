"use client"

import React, { useEffect, useState, useRef, useMemo } from "react"
import {
    ColumnDef,
} from "@tanstack/react-table"

import { toast } from "sonner"
import { StatusBadge } from "@/components/shared"
import { JournalEntryForm } from "@/features/accounting/components/JournalEntryForm"
import api from "@/lib/api"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { Trash2, CheckCircle, Eye, Pencil } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"

import { DataCell, createActionsColumn } from "@/components/ui/data-table-cells"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

import { useJournalEntries, type JournalEntry } from "@/features/accounting/hooks/useJournalEntries"
import { useAccountingAccounts } from "@/features/accounting/hooks/useAccounts"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
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

    const { entity: selectedFromUrl, clearSelection: clearUrlSelected } = useSelectedEntity<JournalEntry>({
        endpoint: '/accounting/entries'
    })

    // T-107: un solo efecto que ramifica por mode — evita flash visual cuando ambos
    // efectos disparaban en el mismo render al recibir ?selected=42&mode=edit (ADR-0020)
    useEffect(() => {
        if (!selectedFromUrl) return
        if (searchParams.get('mode') === 'edit') {
            // Modo edición: abre el form directamente, cierra el viewer si estaba abierto
            setEditingEntry(selectedFromUrl)
            setIsFormOpen(true)
            setViewingTransaction(null)
        } else {
            // Modo detalle: abre el viewer de transacción
            setViewingTransaction({ type: 'journal_entry', id: selectedFromUrl.id })
        }
    }, [selectedFromUrl, searchParams])
    const clearSelection = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('selected')
        params.delete('mode')
        const query = params.toString()
        router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
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

    const handleEditEntry = (entry: JournalEntry) => {
        setEditingEntry(entry)
        setIsFormOpen(true)
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

    const columns: ColumnDef<JournalEntry>[] = useMemo(() => [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <DataCell.DocumentId type="JOURNAL_ENTRY" number={row.getValue("number")} />
                </div>
            ),
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
                <DataCell.Text className="text-center">
                    <span className="truncate max-w-[300px]">{row.getValue("description")}</span>
                </DataCell.Text>
            )
        },
        {
            accessorKey: "state",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" className="justify-center" />
            ),
            cell: ({ row }) => (
                <div className="flex justify-center w-full">
                    <StatusBadge status={row.getValue("state")} />
                </div>
            ),
        },
        createActionsColumn<JournalEntry>({
            renderActions: (entry) => (
                <>
                    <DataCell.Action
                        icon={Eye}
                        title="Ver Detalle"
                        onClick={() => {
                            const params = new URLSearchParams(searchParams.toString())
                            params.set('selected', String(entry.id))
                            router.push(`${pathname}?${params.toString()}`, { scroll: false })
                        }}
                    />
                    {entry.state === 'DRAFT' && (
                        <>
                            <DataCell.Action
                                icon={Pencil}
                                title="Editar"
                                onClick={() => {
                                    const params = new URLSearchParams(searchParams.toString())
                                    params.set('selected', String(entry.id))
                                    params.set('mode', 'edit') // Add a mode param to distinguish
                                    router.push(`${pathname}?${params.toString()}`, { scroll: false })
                                }}
                            />
                            <DataCell.Action
                                icon={CheckCircle}
                                title="Publicar"
                                className="text-muted-foreground hover:text-success"
                                onClick={() => handlePost(entry.id)}
                            />
                        </>
                    )}
                    <DataCell.Action
                        icon={Trash2}
                        title="Eliminar"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(entry.id)}
                    />
                </>
            )
        }),
    ], [accounts])


    return (
        <div className="space-y-4">
            <div className="pt-2">
                <DataTable
                    columns={columns}
                    data={entries}
                    isLoading={isLoading}
                    variant="embedded"
                    leftAction={<SmartSearchBar searchDef={journalEntrySearchDef} placeholder="Buscar asientos..." className="w-80" />}
                    defaultPageSize={20}
                    createAction={createAction}
                />

                <JournalEntryForm
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
                    <TransactionViewModal
                        open={!!viewingTransaction}
                        onOpenChange={(open) => {
                            if (!open) {
                                setViewingTransaction(null)
                                clearSelection()
                            }
                        }}
                        type={viewingTransaction.type}
                        id={viewingTransaction.id}
                    />
                )}
            </div>
        </div>
    )
}
