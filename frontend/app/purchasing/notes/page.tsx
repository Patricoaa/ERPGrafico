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
import { ReceiptModal } from "@/components/purchasing/ReceiptModal"

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
    related_documents?: {
        invoices: any[]
        notes: any[]
        receipts: any[]
        payments: any[]
    }
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
    const [viewingNote, setViewingNote] = useState<{ type: any, id: number | string, view?: any } | null>(null)
    const [payingNote, setPayingNote] = useState<Note | null>(null)
    const [receivingNote, setReceivingNote] = useState<Note | null>(null)

    useEffect(() => {
        fetchNotes()
    }, [])

    const fetchNotes = async () => {
        setLoading(true)
        try {
            const response = await api.get('/billing/invoices/')
            // Now the serializer includes related_documents
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

    const handlePaymentConfirm = async (paymentData: any) => {
        try {
            await api.post('/treasury/payments/', {
                ...paymentData,
                purchase_order: payingNote?.purchase_order,
                invoice: payingNote?.id,
                payment_type: payingNote?.dte_type === 'NOTA_CREDITO' ? 'INBOUND' : 'OUTBOUND'
            })
            toast.success("Operación registrada correctamente")
            setPayingNote(null)
            fetchNotes()
        } catch (error) {
            console.error("Error registering payment:", error)
            toast.error("Error al registrar la operación")
        }
    }

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
                            <TableHead>Documentos</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead className="text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10">Cargando...</TableCell>
                            </TableRow>
                        ) : filteredNotes.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground italic">No se encontraron notas</TableCell>
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
                                <TableCell>
                                    <div className="flex flex-col gap-1">
                                        {note.related_documents?.invoices.map((inv: any) => (
                                            <button
                                                key={inv.id}
                                                onClick={() => setViewingNote({ type: 'invoice', id: inv.id, view: 'details' })}
                                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                            >
                                                <span className="font-semibold uppercase text-[8px] text-muted-foreground">Factura</span>
                                                #{inv.number}
                                            </button>
                                        ))}
                                        {note.related_documents?.notes.filter((n: any) => n.id !== note.id).map((n: any) => (
                                            <button
                                                key={n.id}
                                                onClick={() => setViewingNote({ type: 'invoice', id: n.id, view: 'details' })}
                                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                            >
                                                <span className="font-semibold uppercase text-[8px] text-muted-foreground">Nota {n.type === 'NOTA_CREDITO' ? 'Crédito' : 'Débito'}</span>
                                                #{n.number}
                                            </button>
                                        ))}
                                        {(note.related_documents?.receipts?.length ?? 0) > 0 && (
                                            <button
                                                onClick={() => setViewingNote({ type: 'purchase_order', id: note.purchase_order!, view: 'details' })}
                                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                            >
                                                <span className="font-semibold uppercase text-[8px] text-muted-foreground whitespace-nowrap">Recepciones</span>
                                                <span className="text-[10px]">{note.related_documents?.receipts?.length} recep.</span>
                                            </button>
                                        )}
                                        {(note.related_documents?.payments?.length ?? 0) > 0 && (
                                            <button
                                                onClick={() => setViewingNote({ type: 'purchase_order', id: note.purchase_order!, view: 'history' })}
                                                className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                            >
                                                <span className="font-semibold uppercase text-[8px] text-muted-foreground whitespace-nowrap">Pagos</span>
                                                <span className="text-[10px]">{note.related_documents?.payments?.length} reg.</span>
                                            </button>
                                        )}
                                    </div>
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
                                    <div className="flex justify-center space-x-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setViewingNote({ type: 'invoice', id: note.id, view: 'details' })}
                                            title="Ver Detalle"
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-blue-600"
                                            onClick={() => setReceivingNote(note)}
                                            title="Recepcionar Mercadería"
                                        >
                                            <Receipt className="h-4 w-4" />
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
                    id={viewingNote.id}
                    type={viewingNote.type}
                    view={viewingNote.view || "details"}
                />
            )}

            {payingNote && (
                <PaymentDialog
                    open={!!payingNote}
                    onOpenChange={(open) => !open && setPayingNote(null)}
                    onConfirm={handlePaymentConfirm}
                    isPurchase={true}
                    total={parseFloat(payingNote.total)}
                    pendingAmount={payingNote.pending_amount ?? parseFloat(payingNote.total)}
                    existingInvoice={{
                        dte_type: payingNote.dte_type,
                        number: payingNote.number,
                        document_attachment: null
                    }}
                />
            )}

            {receivingNote && receivingNote.purchase_order && (
                <ReceiptModal
                    open={!!receivingNote}
                    onOpenChange={(open) => !open && setReceivingNote(null)}
                    orderId={receivingNote.purchase_order}
                    onSuccess={fetchNotes}
                />
            )}
        </div>
    )
}
