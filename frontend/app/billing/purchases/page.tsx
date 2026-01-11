"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Eye, FileBadge, Banknote, Package, Trash2, Pencil, History, FileEdit, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import api from "@/lib/api"
import { toast } from "sonner"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { PaymentDialog } from "@/components/shared/PaymentDialog"
import { ReceiptModal } from "@/components/purchasing/ReceiptModal"
import { PurchaseNoteModal } from "@/components/purchasing/PurchaseNoteModal"
import { DocumentCompletionModal } from "@/components/shared/DocumentCompletionModal"
import { Progress } from "@/components/ui/progress"

interface PurchaseDocument {
    id: number
    date: string
    dte_type: string
    dte_type_display?: string
    number: string
    partner_name?: string
    purchase_order?: number
    purchase_order_number?: string
    service_obligation?: number
    service_obligation_data?: any
    total: string
    status: string
    status_display?: string
    pending_amount?: number
    serialized_payments?: any[]
    po_receiving_status?: string
    related_stock_moves?: any[]
    related_documents?: {
        invoices: any[]
        notes: any[]
        receipts: any[]
        payments: any[]
    }
}

const statusMap: Record<string, { label: string, variant: "default" | "secondary" | "destructive" | "outline" | "success" | "info" | "warning" }> = {
    'DRAFT': { label: 'Folio Pendiente', variant: 'warning' as any },
    'POSTED': { label: 'Publicado', variant: 'info' },
    'PAID': { label: 'Pagado', variant: 'success' },
    'CANCELLED': { label: 'Anulado', variant: 'destructive' },
}

export default function PurchaseInvoicesPage() {
    const [documents, setDocuments] = useState<PurchaseDocument[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' | 'all' } | null>(null)

    const [payingDoc, setPayingDoc] = useState<PurchaseDocument | null>(null)
    const [receivingDoc, setReceivingDoc] = useState<PurchaseDocument | null>(null)
    const [notingDoc, setNotingDoc] = useState<PurchaseDocument | null>(null)
    const [completingDoc, setCompletingDoc] = useState<PurchaseDocument | null>(null)

    useEffect(() => {
        fetchDocuments()
    }, [])

    const fetchDocuments = async () => {
        try {
            const res = await api.get('/billing/invoices/')
            const results = res.data.results || res.data
            // Filter only purchases (those with purchase_order OR explicitly purchase DTE types if PO missing for some reason)
            // Ideally backend filters, but frontend filter for strict "Purchase" context:
            // Includes: FACTURA_COMPRA (custom type?), or standard Invoices linked to PO, or NC/ND linked to PO.
            // Let's stick to "linked to purchase_order" or "DTE Type is specifically Purchase-related" check.
            // Include: Invoices with PO OR Invoices with Service Obligation
            const filtered = results.filter((i: any) => i.purchase_order || i.service_obligation)
            setDocuments(filtered)
        } catch (error) {
            console.error(error)
            toast.error("Error al cargar documentos")
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar este documento?")) return

        try {
            await api.delete(`/billing/invoices/${id}/`)
            toast.success("Documento eliminado correctamente")
            fetchDocuments()
        } catch (error: any) {
            console.error("Error deleting document:", error)
            toast.error(error.response?.data?.error || "No se pudo eliminar el documento")
        }
    }

    const handleAnnul = async (id: number, force: boolean = false) => {
        if (!force && !confirm("¿Está seguro de que desea ANULAR este documento? Esta acción generará reversos contables y no se puede deshacer.")) return
        try {
            await api.post(`/billing/invoices/${id}/annul/`, { force })
            toast.success("Documento anulado correctamente.")
            fetchDocuments()
        } catch (error: any) {
            console.error("Error annulling invoice:", error)
            const errorMessage = error.response?.data?.error || ""

            if (errorMessage.includes("Debe anular los pagos asociados") && !force) {
                if (confirm("Este documento tiene pagos asociados. ¿Desea anular también todos los pagos vinculados automáticamente?")) {
                    handleAnnul(id, true)
                    return
                }
            }

            toast.error(errorMessage || "Error al anular el documento.")
        }
    }

    const handlePayment = async (data: any) => {
        if (!payingDoc) return
        try {
            const formData = new FormData()
            formData.append('amount', data.amount.toString())

            // Auto-detect direction based on document type
            let paymentType = 'OUTBOUND' // Default for paying a bill
            const isCreditNote = payingDoc.dte_type === 'NOTA_CREDITO'
            if (isCreditNote) paymentType = 'INBOUND' // Receiving money back (Devolución)

            formData.append('payment_type', paymentType)
            formData.append('reference', `${payingDoc.dte_type === 'NOTA_CREDITO' ? 'NC' : payingDoc.dte_type === 'NOTA_DEBITO' ? 'ND' : 'PAGO'}-${payingDoc.number}`)
            formData.append('purchase_order', payingDoc.purchase_order ? payingDoc.purchase_order.toString() : '')
            formData.append('invoice', payingDoc.id.toString())
            formData.append('payment_method', data.paymentMethod)

            if (data.transaction_number) formData.append('transaction_number', data.transaction_number)
            if (data.is_pending_registration !== undefined) formData.append('is_pending_registration', data.is_pending_registration.toString())
            if (data.treasury_account_id) formData.append('treasury_account_id', data.treasury_account_id)
            if (data.dteType) formData.append('dte_type', data.dteType)
            if (data.documentReference) formData.append('document_reference', data.documentReference)
            if (data.documentDate) formData.append('document_date', data.documentDate)
            if (data.documentAttachment) formData.append('document_attachment', data.documentAttachment)

            await api.post('/treasury/payments/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            })
            toast.success("Operación registrada correctamente")
            setPayingDoc(null)
            fetchDocuments()
        } catch (error: any) {
            console.error("Error registering payment:", error)
            toast.error(error.response?.data?.error || "Error al registrar la operación")
        }
    }

    const filtered = documents.filter(i =>
        (i.number && i.number.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (i.partner_name && i.partner_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (i.purchase_order_number && i.purchase_order_number.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Documentos Recibidos</h1>
            </div>

            <Card>
                <CardHeader>
                    <div className="relative">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar por número, proveedor u OC..."
                            className="pl-8"
                            value={searchTerm}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>N° Documento</TableHead>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead>Proveedor</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                                <TableHead>Pagado/Devuelto</TableHead>
                                <TableHead>Estado</TableHead>
                                <TableHead>Documentos</TableHead>
                                <TableHead className="text-center">Acciones</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-10">Cargando...</TableCell></TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No se encontraron documentos.</TableCell></TableRow>
                            ) : filtered.map((doc) => {
                                const isNote = ['NOTA_CREDITO', 'NOTA_DEBITO'].includes(doc.dte_type)
                                const badgeStyle = statusMap[doc.status] || { label: doc.status, variant: 'secondary' }

                                return (
                                    <TableRow key={doc.id}>
                                        <TableCell>
                                            <span className="font-mono font-medium">{doc.number}</span>
                                        </TableCell>
                                        <TableCell>{new Date(doc.date).toLocaleDateString()}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2" title={doc.dte_type_display}>
                                                <FileBadge className={`h-4 w-4 ${doc.dte_type === 'NOTA_CREDITO' ? 'text-blue-500' : doc.dte_type === 'NOTA_DEBITO' ? 'text-amber-500' : 'text-slate-600'}`} />
                                                <span className="text-xs font-bold uppercase hidden md:inline-block">
                                                    {doc.dte_type === 'NOTA_CREDITO' ? 'NC' :
                                                        doc.dte_type === 'NOTA_DEBITO' ? 'ND' :
                                                            doc.dte_type === 'BOLETA' ? 'BOL' : 'FACT'}
                                                </span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{doc.partner_name}</TableCell>
                                        <TableCell className="text-right font-medium">
                                            ${Number(doc.total).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            <div className="space-y-1 w-32">
                                                {(() => {
                                                    const total = parseFloat(doc.total)
                                                    const pending = doc.pending_amount ?? total
                                                    const paid = total - pending
                                                    const percentage = total > 0 ? Math.round((paid / total) * 100) : 0
                                                    return (
                                                        <>
                                                            <div className="flex justify-between text-[10px] font-bold">
                                                                <span>{percentage}%</span>
                                                                <span>${paid.toLocaleString()}</span>
                                                            </div>
                                                            <Progress value={percentage} className="h-1" />
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {doc.status !== 'POSTED' && (
                                                    <Badge variant={badgeStyle.variant as any} className="text-[8px] h-4 px-1 uppercase whitespace-nowrap">
                                                        {badgeStyle.label}
                                                    </Badge>
                                                )}
                                                {/* Additional Status Badges */}
                                                <div className="flex flex-wrap gap-1">
                                                    {(doc.pending_amount ?? 0) <= 0 && doc.status !== 'DRAFT' && doc.status !== 'PAID' && (
                                                        <Badge variant="success" className="text-[8px] h-4 px-1 uppercase whitespace-nowrap">Pagado</Badge>
                                                    )}
                                                    {doc.po_receiving_status === 'RECEIVED' && (
                                                        <Badge variant="outline" className="text-[8px] h-4 px-1 uppercase border-orange-500 text-orange-600 font-bold whitespace-nowrap">
                                                            {doc.dte_type === 'NOTA_CREDITO' ? 'Devuelto' : 'Recibido'}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-col gap-1">
                                                {/* Purchase Order Link (Only for non-Notes or if Note has no originating inv) */}
                                                {doc.purchase_order && !isNote && (
                                                    <button
                                                        onClick={() => setViewingTransaction({ type: 'purchase_order', id: doc.purchase_order!, view: 'details' })}
                                                        className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                    >
                                                        <span className="font-semibold uppercase text-[8px] text-muted-foreground">Orden de Compra</span>
                                                        OC-{doc.purchase_order_number || doc.purchase_order}
                                                    </button>
                                                )}

                                                {doc.service_obligation && (
                                                    <button
                                                        onClick={() => setViewingTransaction({ type: 'service_obligation', id: doc.service_obligation!, view: 'details' })}
                                                        className="text-indigo-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                    >
                                                        <span className="font-semibold uppercase text-[8px] text-muted-foreground">Servicio Recurrente</span>
                                                        OB-{doc.service_obligation}
                                                    </button>
                                                )}

                                                {/* Show Originating Invoice if this is a Note */}
                                                {isNote && doc.related_documents?.invoices?.filter((inv: any) => inv.id !== doc.id && !['NOTA_CREDITO', 'NOTA_DEBITO'].includes(inv.dte_type)).map((inv: any) => (
                                                    <button
                                                        key={inv.id}
                                                        onClick={() => setViewingTransaction({ type: 'invoice', id: inv.id, view: 'details' })}
                                                        className="text-indigo-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                    >
                                                        <span className="font-semibold uppercase text-[8px] text-muted-foreground">Origen: {inv.dte_type === 'FACTURA' ? 'Factura' : 'Boleta'}</span>
                                                        {inv.dte_type === 'FACTURA' ? `FACT-${inv.number}` : `BOL-${inv.number}`}
                                                    </button>
                                                ))}

                                                {/* Stock Moves: For NC/ND show specific moves, for others show order receipts */}
                                                {isNote ? (
                                                    doc.related_stock_moves?.map((move: any) => (
                                                        <button
                                                            key={move.id}
                                                            onClick={() => setViewingTransaction({ type: 'inventory', id: move.id, view: 'details' })}
                                                            className="text-orange-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                        >
                                                            <span className="font-semibold uppercase text-[8px] text-muted-foreground">Mov. Stock</span>
                                                            MOV-{move.id}
                                                        </button>
                                                    ))
                                                ) : (
                                                    doc.related_documents?.receipts?.map((rec: any) => (
                                                        <button
                                                            key={rec.id}
                                                            onClick={() => setViewingTransaction({ type: 'inventory', id: rec.id, view: 'details' })}
                                                            className="text-orange-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                        >
                                                            <span className="font-semibold uppercase text-[8px] text-muted-foreground">Mov. Stock</span>
                                                            {rec.number}
                                                        </button>
                                                    ))
                                                )}

                                                {/* Payments specific to this Document */}
                                                {doc.related_documents?.payments?.filter((p: any) => p.invoice_id === doc.id).map((pay: any) => (
                                                    <button
                                                        key={pay.id}
                                                        onClick={() => setViewingTransaction({ type: 'payment', id: pay.id, view: 'details' })}
                                                        className="text-emerald-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                    >
                                                        <span className="font-semibold uppercase text-[8px] text-muted-foreground whitespace-nowrap">Pago</span>
                                                        {pay.code}
                                                    </button>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex justify-center space-x-1">
                                                {/* View Details */}
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => setViewingTransaction({ type: 'invoice', id: doc.id, view: 'details' })}
                                                    title="Ver Detalle"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </Button>

                                                {/* Finalize Folio (Draft only) */}
                                                {doc.status === 'DRAFT' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-amber-600"
                                                        onClick={() => setCompletingDoc(doc)}
                                                        title="Completar Folio"
                                                    >
                                                        <FileEdit className="h-4 w-4" />
                                                    </Button>
                                                )}

                                                {/* Receive/Send Merchandise */}
                                                {(doc.purchase_order || isNote) && doc.po_receiving_status !== 'RECEIVED' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-orange-600"
                                                        onClick={() => setReceivingDoc(doc)}
                                                        title={doc.dte_type === 'NOTA_CREDITO' ? "Devolución Mercadería" : "Recibir Mercadería"}
                                                    >
                                                        <Package className="h-4 w-4" />
                                                    </Button>
                                                )}


                                                {/* Credit/Debit Note (Only for primary documents with folio) */}
                                                {doc.purchase_order && !isNote && doc.number && doc.status !== 'DRAFT' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-amber-600"
                                                        onClick={() => setNotingDoc(doc)}
                                                        title="Registrar Nota Crédito/Débito"
                                                    >
                                                        <FileBadge className="h-4 w-4" />
                                                    </Button>
                                                )}

                                                {/* Register Payment / Refund */}
                                                {(doc.pending_amount ?? 0) > 0 && ['POSTED'].includes(doc.status) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-emerald-600"
                                                        onClick={() => setPayingDoc(doc)}
                                                        title={doc.dte_type === 'NOTA_CREDITO' ? "Registrar Devolución Dinero" : "Registrar Pago"}
                                                    >
                                                        <Banknote className="h-4 w-4" />
                                                    </Button>
                                                )}

                                                {/* Payment History */}
                                                {((doc.related_documents?.payments?.length ?? 0) > 0 || (doc.serialized_payments?.length ?? 0) > 0) && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-emerald-600"
                                                        onClick={() => setViewingTransaction({ type: 'invoice', id: doc.id, view: 'history' })}
                                                        title="Historial de Pagos"
                                                    >
                                                        <History className="h-4 w-4" />
                                                    </Button>
                                                )}

                                                {doc.status === 'DRAFT' ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive"
                                                        onClick={() => handleDelete(doc.id)}
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                ) : doc.status !== 'CANCELLED' ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => handleAnnul(doc.id)}
                                                        title="Anular Documento"
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {viewingTransaction && (
                <TransactionViewModal
                    open={!!viewingTransaction}
                    onOpenChange={(open: boolean) => !open && setViewingTransaction(null)}
                    type={viewingTransaction.type}
                    id={viewingTransaction.id}
                    view={viewingTransaction.view}
                />
            )}

            {payingDoc && (
                <PaymentDialog
                    open={!!payingDoc}
                    onOpenChange={(open: boolean) => !open && setPayingDoc(null)}
                    onConfirm={handlePayment}
                    isPurchase={true}
                    total={parseFloat(payingDoc.total)}
                    pendingAmount={payingDoc.pending_amount ?? parseFloat(payingDoc.total)}
                    hideDteFields={true}
                    isRefund={payingDoc.dte_type === 'NOTA_CREDITO'}
                    existingInvoice={{
                        dte_type: payingDoc.dte_type,
                        number: payingDoc.number,
                        document_attachment: null
                    }}
                />
            )}

            {receivingDoc && receivingDoc.purchase_order && (
                <ReceiptModal
                    open={!!receivingDoc}
                    onOpenChange={(open: boolean) => !open && setReceivingDoc(null)}
                    orderId={receivingDoc.purchase_order}
                    onSuccess={fetchDocuments}
                    isRefund={receivingDoc.dte_type === 'NOTA_CREDITO'}
                />
            )}


            {notingDoc && notingDoc.purchase_order && (
                <PurchaseNoteModal
                    open={!!notingDoc}
                    onOpenChange={(open: boolean) => !open && setNotingDoc(null)}
                    orderId={notingDoc.purchase_order}
                    orderNumber={notingDoc.purchase_order_number || notingDoc.purchase_order.toString()}
                    invoiceId={notingDoc.id}
                    onSuccess={fetchDocuments}
                />
            )}

            {completingDoc && (
                <DocumentCompletionModal
                    open={!!completingDoc}
                    onOpenChange={(open: boolean) => !open && setCompletingDoc(null)}
                    invoiceId={completingDoc.id}
                    invoiceType={completingDoc.dte_type}
                    onSuccess={fetchDocuments}
                />
            )}
        </div>
    )
}
