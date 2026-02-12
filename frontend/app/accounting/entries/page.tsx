"use client"

import { useEffect, useState } from "react"
import {
    ColumnDef,
} from "@tanstack/react-table"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { JournalEntryForm } from "@/components/forms/JournalEntryForm"
import api from "@/lib/api"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { Trash2, CheckCircle, Eye } from "lucide-react"
import { DataTable } from "@/components/ui/data-table"
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header"
import { PageHeader } from "@/components/shared/PageHeader"
import { formatPlainDate } from "@/lib/utils"

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

export default function EntriesPage() {
    const [entries, setEntries] = useState<JournalEntry[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string } | null>(null)

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
                <DataTableColumnHeader column={column} title="Número" />
            ),
            cell: ({ row }) => (
                <span className="font-medium">AS-{row.getValue("number")}</span>
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
            id: "documents",
            header: "Documentos",
            cell: ({ row }) => {
                const entry = row.original
                return (
                    <div className="flex flex-col gap-1">
                        {entry.source_documents && entry.source_documents.length > 0 ? (
                            entry.source_documents.map((doc, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setViewingTransaction({ type: doc.type, id: doc.id })}
                                    className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                >
                                    <span className="font-semibold uppercase text-[8px] text-muted-foreground whitespace-nowrap">
                                        {doc.type === 'invoice' ? (doc.name.includes('BOL') ? 'Boleta' :
                                            doc.name.includes('NC') ? 'Nota de Crédito' :
                                                doc.name.includes('ND') ? 'Nota de Débito' : 'Factura') :
                                            doc.type === 'payment' ? (doc.name.includes('ING') ? 'Comprobante Ingreso' : 'Comprobante Egreso') :
                                                doc.type === 'purchase_order' ? 'Orden de Compra' :
                                                    doc.type === 'sale_order' ? 'Nota de Venta' :
                                                        doc.type === 'inventory' ? 'Movimiento' : doc.type}
                                    </span>
                                    {doc.name}
                                </button>
                            ))
                        ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                        )}
                    </div>
                )
            },
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
                            <Eye className="h-4 w-4 text-blue-600" />
                        </Button>
                        {entry.state === 'DRAFT' && (
                            <>
                                <JournalEntryForm
                                    accounts={accounts}
                                    initialData={entry}
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
                            className="text-red-500"
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
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Asientos Contables"
                description="Registro cronológico de todas las transacciones contables del sistema."
                titleActions={
                    <JournalEntryForm accounts={accounts} onSuccess={fetchEntries} triggerVariant="circular" />
                }
            />

            {loading ? (
                <div className="rounded-xl border shadow-sm overflow-hidden bg-card p-10 text-center">
                    Cargando asientos...
                </div>
            ) : (
                <div className="">
                    <DataTable
                        columns={columns}
                        data={entries}
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
                </div>
            )}

            {viewingTransaction && (
                <TransactionViewModal
                    open={!!viewingTransaction}
                    onOpenChange={(open) => !open && setViewingTransaction(null)}
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                />
            )}
        </div>
    )
}
