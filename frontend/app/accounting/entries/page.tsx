"use client"

import { useEffect, useState } from "react"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { JournalEntryForm } from "@/components/forms/JournalEntryForm"
import api from "@/lib/api"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

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
            const response = await api.get('/accounting/accounts/')
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

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Asientos Contables</h2>
                <div className="flex items-center space-x-2">
                    <JournalEntryForm accounts={accounts} onSuccess={fetchEntries} />
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Número</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.map((entry) => (
                            <TableRow key={entry.id}>
                                <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                                <TableCell className="font-medium">{entry.number}</TableCell>
                                <TableCell>{entry.description}</TableCell>
                                <TableCell>{entry.reference || "-"}</TableCell>
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {entry.source_documents && entry.source_documents.length > 0 ? (
                                            entry.source_documents.map((doc, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => setViewingTransaction({ type: doc.type, id: doc.id })}
                                                    className="text-blue-600 hover:underline text-xs flex flex-col text-left items-start"
                                                >
                                                    <span className="font-semibold uppercase text-[9px] text-muted-foreground leading-tight">
                                                        {doc.type}
                                                    </span>
                                                    {doc.name}
                                                </button>
                                            ))
                                        ) : (
                                            <span className="text-muted-foreground">-</span>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${entry.state === 'POSTED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {entry.state === 'POSTED' ? 'Publicado' : 'Borrador'}
                                    </span>
                                </TableCell>
                                <TableCell className="text-right space-x-2">
                                    <JournalEntryForm
                                        accounts={accounts}
                                        initialData={entry}
                                        onSuccess={fetchEntries}
                                        triggerText="Editar"
                                    />
                                    {entry.state === 'DRAFT' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handlePost(entry.id)}
                                        >
                                            Publicar
                                        </Button>
                                    )}
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => handleDelete(entry.id)}
                                    >
                                        Eliminar
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center">Cargando asientos...</TableCell>
                            </TableRow>
                        )}
                        {!loading && entries.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center">No hay asientos registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

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
