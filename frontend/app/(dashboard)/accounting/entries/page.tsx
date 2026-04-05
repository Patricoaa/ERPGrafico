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
import { formatPlainDate, cn } from "@/lib/utils"
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
        {
            id: "actions",
            header: ({ column }) => (
                <DataTableColumnHeader column={column} title="Acciones" className="justify-center" />
            ),
            cell: ({ row }) => {
                const entry = row.original
                return (
                    <div className="flex items-center justify-center gap-1 w-full">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-primary/10 hover:text-primary transition-colors"
                            onClick={() => setViewingTransaction({ type: 'journal_entry', id: entry.id })}
                            title="Ver Detalle"
                        >
                            <Eye className="h-3.5 w-3.5" />
                        </Button>
                        {entry.state === 'DRAFT' && (
                            <>
                                <JournalEntryForm
                                    accounts={accounts}
                                    initialData={entry as any}
                                    onSuccess={fetchEntries}
                                    triggerVariant="circular"
                                />
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 rounded-xl hover:bg-success/10 hover:text-success transition-colors group"
                                    onClick={() => handlePost(entry.id)}
                                    title="Publicar"
                                >
                                    <CheckCircle className="h-4 w-4 text-muted-foreground/30 group-hover:text-success transition-colors" />
                                </Button>
                            </>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-xl hover:bg-destructive/10 hover:text-destructive text-muted-foreground/30 transition-colors"
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
