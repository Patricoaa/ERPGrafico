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
import { useAccountingAccounts } from "@/features/accounting/hooks/useAccounts" // I'll update this hook next

export default function EntriesPage({ externalOpen, onExternalOpenChange, createAction }: EntriesPageProps) {
    const { entries, refetch } = useJournalEntries()
    const { accounts } = useAccountingAccounts({ filters: { is_leaf: true } })
    const [viewingTransaction, setViewingTransaction] = useState<{ type: 'journal_entry', id: number | string } | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)
    const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null)

    // Guard for async operations
    const isMounted = useRef(true)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

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
            handleCloseModal()
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
                        onClick={() => setViewingTransaction({ type: 'journal_entry', id: entry.id })}
                    />
                    {entry.state === 'DRAFT' && (
                        <>
                            <DataCell.Action
                                icon={Pencil}
                                title="Editar"
                                onClick={() => handleEditEntry(entry)}
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
                    cardMode
                    filterColumn="description"
                    searchPlaceholder="Buscar por descripción..."
                    facetedFilters={[
                        {
                            column: "state",
                            title: "Estado",
                            options: [
                                { label: "Borrador", value: "DRAFT" },
                                { label: "Publicado", value: "POSTED" },
                            ],
                        },
                    ]}
                    useAdvancedFilter={true}
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
                        onOpenChange={(open) => !open && setViewingTransaction(null)}
                        type={viewingTransaction.type}
                        id={viewingTransaction.id}
                    />
                )}
            </div>
        </div>
    )
}
