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
import { Trash2, Eye, FileBadge, Receipt, Search, FileText, Banknote } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { Input } from "@/components/ui/input"

import { PaymentDialog } from "@/components/shared/PaymentDialog"

interface Note {
    id: number
    dte_type: string
    number: string
    date: string
    total: string
    status: string
    purchase_order_number?: string
    purchase_order?: number
    pending_amount?: number
    supplier_name?: string
}

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "destructive" | "outline" | "success" | "info" }> = {
    'DRAFT': { label: 'Borrador', variant: 'outline' },
    'POSTED': { label: 'Publicado', variant: 'default' },
    'PAID': { label: 'Pagado', variant: 'success' },
    'CANCELLED': { label: 'Anulado', variant: 'destructive' },
}

export default function PurchaseNotesPage() {
    const [notes, setNotes] = useState<Note[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [viewingNote, setViewingNote] = useState<{ id: number | string } | null>(null)
    const [payingNote, setPayingNote] = useState<Note | null>(null)

    useEffect(() => {
        fetchNotes()
    }, [])

    const fetchNotes = async () => {
        setLoading(true)
        try {
            const response = await api.get('/billing/invoices/')
            const filteredNotes = response.data.filter((inv: any) =>
                ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type) && inv.purchase_order
            )
            setNotes(filteredNotes)
        } catch (error) {
            console.error("Error fetching notes:", error)
            toast.error("No se pudieron cargar las notas")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar esta nota? Se revertirán los efectos contables e inventario.")) return

        try {
            await api.delete(`/billing/invoices/${id}/`)
            toast.success("Nota eliminada correctamente")
            fetchNotes()
        } catch (error) {
            console.error("Error deleting note:", error)
            toast.error("No se pudo eliminar la nota")
        }
    }

    const filteredNotes = notes.filter(n =>
        n.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.purchase_order_number?.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Notas de Crédito y Débito</h2>
                    <p className="text-muted-foreground">Gestión de devoluciones y ajustes de compras</p>
                </div>
            </div>

            <div className="flex items-center py-4">
                <div className="relative w-72">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Buscar por folio o OC..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Folio</TableHead>
                            <TableHead>OC Relacionada</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10">Cargando...</TableCell>
                            </TableRow>
                        ) : filteredNotes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground italic">No se encontraron notas</TableCell>
                            </TableRow>
                        ) : filteredNotes.map((note) => (
                            <TableRow key={note.id}>
                                <TableCell>{new Date(note.date).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <FileBadge className={`h-4 w-4 ${note.dte_type === 'NOTA_CREDITO' ? 'text-blue-500' : 'text-amber-500'}`} />
                                        <span className="text-xs font-bold uppercase">{note.dte_type.replace('_', ' ')}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="font-bold">{note.number}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="font-mono">
                                        OC-{note.purchase_order_number || note.purchase_order}
                                    </Badge>
                                </TableCell>
                                <TableCell className="font-black text-primary">
                                    ${parseFloat(note.total).toLocaleString()}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={statusMap[note.status]?.variant || "default"}>
                                        {statusMap[note.status]?.label || note.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center space-x-2">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setViewingNote({ id: note.id })}
                                            title="Ver Detalle"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-emerald-600"
                                            onClick={() => setPayingNote(note)}
                                            title={note.dte_type === 'NOTA_CREDITO' ? "Registrar Devolución Dinero" : "Registrar Pago"}
                                        >
                                            <Banknote className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-destructive"
                                            onClick={() => handleDelete(note.id)}
                                            title="Eliminar"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {viewingNote && (
                <TransactionViewModal
                    open={!!viewingNote}
                    onOpenChange={(open) => !open && setViewingNote(null)}
                    transactionId={viewingNote.id}
                    transactionType="purchase_order"
                    view="details"
                />
            )}

            {payingNote && (
                <PaymentDialog
                    open={!!payingNote}
                    onOpenChange={(open) => !open && setPayingNote(null)}
                    onSuccess={fetchNotes}
                    orderType="purchase"
                    orderId={payingNote.purchase_order!}
                    totalAmount={parseFloat(payingNote.total)}
                    pendingAmount={payingNote.pending_amount ?? parseFloat(payingNote.total)}
                    supplierName={payingNote.supplier_name}
                    existingInvoice={{
                        dte_type: payingNote.dte_type,
                        number: payingNote.number,
                        document_attachment: null
                    }}
                />
            )}
        </div>
    )
}
