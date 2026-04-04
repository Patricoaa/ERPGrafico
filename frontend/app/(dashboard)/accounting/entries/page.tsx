"use client"

import { useEffect, useState } from "react"
import {
    ColumnDef,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { JournalEntryForm } from "@/features/accounting/components/JournalEntryForm"
import api from "@/lib/api"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { Trash2, CheckCircle, Eye } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { formatPlainDate } from "@/lib/utils"
import { DataCell } from "@/components/ui/data-table-cells"
import { useRouter, usePathname, useSearchParams } from "next/navigation"

interface JournalEntry {
    id: number
    number: string
    date: string
    description: string
    reference: string
    state: string
    source_documents?: {
        type: any
        id: number | string
        name: string
        url: string
    }[]
}

interface EntriesPageProps {
    externalOpen?: boolean
    onExternalOpenChange?: (open: boolean) => void
}

export default function EntriesPage({ externalOpen, onExternalOpenChange }: EntriesPageProps) {
    const [entries, setEntries] = useState<JournalEntry[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string } | null>(null)
    const [isFormOpen, setIsFormOpen] = useState(false)

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const handleCloseModal = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("modal")
        router.push(`${pathname}?${params.toString()}`)
    }

    // Synchronize external modal trigger
    useEffect(() => {
        if (externalOpen) {
            setIsFormOpen(true)
        }
    }, [externalOpen])

    const handleFormOpenChange = (open: boolean) => {
        setIsFormOpen(open)
        if (!open) {
            onExternalOpenChange?.(false)
            handleCloseModal()
        }
    }

    const fetchEntries = async () => {
        setLoading(true)
        try {
            const response = await api.get('/accounting/entries/')
            setEntries(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch entries", error)
        } finally {
            setLoading(false)
        }
    }

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/accounting/accounts/?is_leaf=true')
            setAccounts(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch accounts", error)
            toast.error("Error al cargar las cuentas contables.")
        }
    }

    useEffect(() => {
        fetchEntries()
        fetchAccounts() // Fetch accounts when component mounts
    }, [])

    const handlePost = async (id: number) => {
        try {
            await api.post(`/accounting/entries/${id}/post_entry/`)
            toast.success("Asiento publicado exitosamente")
            fetchEntries()
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
            fetchEntries()
        } catch (error) {
            console.error("Error deleting entry:", error)
            toast.error("Error al eliminar el asiento")
        }
    }

    const columns: ColumnDef<JournalEntry>[] = [
        {
            accessorKey: "number",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Folio" />
            ),
            cell: ({ row }) => (
                <DataCell.DocumentId type="JOURNAL_ENTRY" number={row.getValue("number")} />
            ),
        },
        {
            accessorKey: "date",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Fecha" />
            ),
            cell: ({ row }) => {
                return formatPlainDate(row.getValue("date"))
            },
        },
        {
            accessorKey: "description",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Descripción" />
            ),
        },
        {
            accessorKey: "state",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Estado" />
            ),
            cell: ({ row }) => {
                const state = row.getValue("state") as string
                return (
                    <Badge variant={state === 'POSTED' ? 'default' : 'secondary'}>
                        {state === 'POSTED' ? 'Publicado' : 'Borrador'}
                    </Badge>
                )
            },
        },
        {
            id: "actions",
            header: "Acciones",
            cell: ({ row }) => {
                const entry = row.original
                return (
                    <div className="flex items-center justify-end gap-1">
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setViewingTransaction({ type: 'journal_entry', id: entry.id })}
                            title="Ver Detalle"
                        >
                            <Eye className="h-4 w-4 text-primary" />
                        </Button>
                        {entry.state === 'DRAFT' && (
                            <>
                                <JournalEntryForm
                                    accounts={accounts}
                                    initialData={entry as any}
                                    onSuccess={fetchEntries}
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="text-emerald-600"
                                    onClick={() => handlePost(entry.id)}
                                    title="Publicar"
                                >
                                    <CheckCircle className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive"
                            onClick={() => handleDelete(entry.id)}
                            title="Eliminar"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                )
            },
        },
    ]

    return (
        <div className="space-y-4">
            <div className="pt-2">
                <DataTable
                    columns={columns}
                    data={entries}
                    isLoading={loading}
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
                />

                <JournalEntryForm 
                    accounts={accounts} 
                    onSuccess={fetchEntries} 
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
