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
import { ArrowDownLeft, ArrowUpRight, Eye, Banknote, CreditCard, Landmark, Receipt, Edit, Save, X, Trash2 } from "lucide-react"
import api from "@/lib/api"
import { PaymentForm } from "@/components/forms/PaymentForm"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

interface Payment {
    id: number
    payment_type: string
    payment_method: string
    payment_method_display: string
    amount: string
    date: string
    reference: string // User manual reference
    transaction_number: string // Bank/Card transaction number
    code: string // System generated ING/EGR
    partner_name: string
    journal_name: string
    document_info?: {
        type: 'invoice' | 'purchase_order' | 'sale_order'
        id: number
        number: string
        label: string
    } | null
}

export default function PaymentsPage() {
    const [payments, setPayments] = useState<Payment[]>([])
    const [loading, setLoading] = useState(true)
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string } | null>(null)
    const [editingId, setEditingId] = useState<number | null>(null)
    const [tempTransactionNumber, setTempTransactionNumber] = useState("")
    const [editingPayment, setEditingPayment] = useState<any>(null)

    const fetchPayments = async () => {
        try {
            setLoading(true)
            const response = await api.get('/treasury/payments/')
            setPayments(response.data.results || response.data)
        } catch (error) {
            console.error("Failed to fetch payments", error)
        } finally {
            setLoading(false)
        }
    }

    const handleUpdateTransactionNumber = async (id: number) => {
        try {
            await api.patch(`/treasury/payments/${id}/`, {
                transaction_number: tempTransactionNumber
            })
            toast.success("N° de transacción actualizado")
            setEditingId(null)
            fetchPayments()
        } catch (error) {
            console.error("Failed to update transaction number", error)
            toast.error("Error al actualizar N° de transacción")
        }
    }

    const handleDeletePayment = async (id: number) => {
        if (!confirm("¿Está seguro de eliminar este pago?")) return
        try {
            await api.delete(`/treasury/payments/${id}/`)
            toast.success("Pago eliminado correctamente")
            fetchPayments()
        } catch (error: any) {
            console.error("Failed to delete payment", error)
            // If it failed because it's posted, suggest annullment? 
            // Better to handle it based on status if we have it in the frontend.
            toast.error(error.response?.data?.error || "Error al eliminar el pago")
        }
    }

    const handleAnnulPayment = async (id: number) => {
        if (!confirm("¿Está seguro de ANULAR este pago? Esta acción generará reversos contables y no se puede deshacer.")) return
        try {
            await api.post(`/treasury/payments/${id}/annul/`)
            toast.success("Pago anulado correctamente")
            fetchPayments()
        } catch (error: any) {
            console.error("Failed to annul payment", error)
            toast.error(error.response?.data?.error || "Error al anular el pago")
        }
    }

    useEffect(() => {
        fetchPayments()
    }, [])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Ingresos y Egresos</h2>
                <div className="flex items-center space-x-2">
                    <PaymentForm onSuccess={fetchPayments} />
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Monto</TableHead>
                            <TableHead>Método de Pago</TableHead>
                            <TableHead>N° Transacción</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Acción</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell className="font-mono text-xs font-bold">{payment.code}</TableCell>
                                <TableCell className="text-muted-foreground">{new Date(payment.date).toLocaleDateString()}</TableCell>
                                <TableCell>
                                    <div className="flex justify-center">
                                        {payment.payment_type === 'INBOUND' ? (
                                            <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs">
                                                <ArrowDownLeft className="h-4 w-4" />
                                                <span>INGRESO</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1 text-red-600 font-bold text-xs">
                                                <ArrowUpRight className="h-4 w-4" />
                                                <span>EGRESO</span>
                                            </div>
                                        )}
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-black font-mono">
                                    <span className={payment.payment_type === 'INBOUND' ? "text-emerald-700" : "text-red-700"}>
                                        ${Number(payment.amount).toLocaleString()}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        {payment.payment_method === 'CASH' && <Banknote className="h-4 w-4 text-emerald-600" />}
                                        {payment.payment_method === 'CARD' && <CreditCard className="h-4 w-4 text-blue-600" />}
                                        {payment.payment_method === 'TRANSFER' && <Landmark className="h-4 w-4 text-indigo-600" />}
                                        {payment.payment_method === 'CREDIT' && <Receipt className="h-4 w-4 text-amber-600" />}
                                        <span className="text-[10px] font-medium uppercase">{payment.payment_method_display}</span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    {editingId === payment.id ? (
                                        <div className="flex items-center gap-1">
                                            <Input
                                                className="h-7 text-[10px] w-24 px-1 font-mono"
                                                value={tempTransactionNumber}
                                                onChange={(e) => setTempTransactionNumber(e.target.value)}
                                                autoFocus
                                            />
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => handleUpdateTransactionNumber(payment.id)}
                                            >
                                                <Save className="h-3.5 w-3.5 text-emerald-600" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-7 w-7"
                                                onClick={() => setEditingId(null)}
                                            >
                                                <X className="h-3.5 w-3.5 text-red-600" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-[10px]">
                                                {payment.transaction_number || '-'}
                                            </span>
                                            {(payment.payment_method === 'CARD' || payment.payment_method === 'TRANSFER') && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    onClick={() => {
                                                        setEditingId(payment.id)
                                                        setTempTransactionNumber(payment.transaction_number || "")
                                                    }}
                                                >
                                                    <Edit className="h-3 w-3 text-blue-600" />
                                                </Button>
                                            )}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            {payment.document_info ? (
                                                <button
                                                    onClick={() => setViewingTransaction({ type: payment.document_info!.type, id: payment.document_info!.id })}
                                                    className="text-blue-600 hover:underline text-[10px] flex flex-col text-left items-start leading-tight"
                                                >
                                                    <span className="font-semibold uppercase text-[8px] text-muted-foreground">
                                                        {payment.document_info.type === 'invoice' ? (payment.document_info.label.includes('Bol') ? 'Boleta' : 'Factura') :
                                                            payment.document_info.type === 'purchase_order' ? 'Orden de Compra' :
                                                                payment.document_info.type === 'sale_order' ? 'Orden de Venta' : payment.document_info.type}
                                                    </span>
                                                    <span className="text-[10px]">
                                                        {payment.document_info.type === 'purchase_order' ? `OC-${payment.document_info.number}` :
                                                            payment.document_info.type === 'sale_order' ? `NV-${payment.document_info.number}` :
                                                                payment.document_info.label.includes('Crédito') ? `NC-${payment.document_info.number}` :
                                                                    payment.document_info.label.includes('Débito') ? `ND-${payment.document_info.number}` :
                                                                        payment.document_info.label.includes('Bol') ? `BOL-${payment.document_info.number}` :
                                                                            `FACT-${payment.document_info.number}`}
                                                    </span>
                                                </button>
                                            ) : (
                                                <span className="font-medium text-xs text-muted-foreground italic">{payment.reference || 'Sin Documento'}</span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-foreground font-bold mt-0.5">{payment.partner_name}</div>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => setViewingTransaction({ type: 'payment', id: payment.id })}
                                            title="Ver Detalle"
                                        >
                                            <Eye className="h-4 w-4 text-blue-600" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => handleAnnulPayment(payment.id)}
                                            title="Anular"
                                        >
                                            <X className="h-4 w-4 text-red-600" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10">Cargando movimientos...</TableCell>
                            </TableRow>
                        )}
                        {!loading && payments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">No hay movimientos registrados.</TableCell>
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

            {editingPayment && (
                <PaymentForm
                    open={!!editingPayment}
                    onOpenChange={(open) => !open && setEditingPayment(null)}
                    initialData={editingPayment}
                    onSuccess={() => {
                        setEditingPayment(null)
                        fetchPayments()
                    }}
                />
            )}
        </div>
    )
}
