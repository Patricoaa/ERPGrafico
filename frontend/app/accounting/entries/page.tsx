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
import { Trash2, CheckCircle, Eye } from "lucide-react"

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

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Asientos Contables</h2>
                <div className="flex items-center space-x-2">
                    <JournalEntryForm accounts={accounts} onSuccess={fetchEntries} />
                </div>
            </div>
            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Documentos</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {entries.map((entry) => (
                            <TableRow key={entry.id} className="group hover:bg-muted/20 transition-colors">
                                <TableCell className="font-medium">AS-{entry.number}</TableCell>
                                <TableCell>{new Date(entry.date).toLocaleDateString()}</TableCell>
                                <TableCell>{entry.description}</TableCell>
                                <TableCell>
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
                                </TableCell>
                                <TableCell>
                                    <Badge variant={entry.state === 'POSTED' ? 'default' : 'secondary'}>
                                        {entry.state === 'POSTED' ? 'Publicado' : 'Borrador'}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right">
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
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center">Cargando asientos...</TableCell>
                            </TableRow>
                        )}
                        {!loading && entries.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center">No hay asientos registrados.</TableCell>
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
