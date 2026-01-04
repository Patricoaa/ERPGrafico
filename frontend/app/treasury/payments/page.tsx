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
import { ArrowDownLeft, ArrowUpRight, Eye } from "lucide-react"
import api from "@/lib/api"
import { PaymentForm } from "@/components/forms/PaymentForm"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"

interface Payment {
    id: number
    payment_type: string
    amount: string
    date: string
    reference: string // User manual reference
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
                            <TableHead className="w-[120px]">Número</TableHead>
                            <TableHead className="w-[120px]">Fecha</TableHead>
                            <TableHead className="w-[100px] text-center">Tipo</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead className="text-right w-[150px]">Monto</TableHead>
                            <TableHead className="text-center w-[80px]">Acción</TableHead>
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
                                                <span className="font-medium text-sm">{payment.reference || 'Pago Manual'}</span>
                                            )}
                                        </div>
                                        <div className="text-[10px] text-muted-foreground font-medium mt-0.5">{payment.partner_name}</div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right font-black font-mono">
                                    <span className={payment.payment_type === 'INBOUND' ? "text-emerald-700" : "text-red-700"}>
                                        ${Number(payment.amount).toLocaleString()}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setViewingTransaction({ type: 'payment', id: payment.id })}
                                            title="Ver Detalle"
                                        >
                                            <Eye className="h-4 w-4 text-blue-600" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10">Cargando movimientos...</TableCell>
                            </TableRow>
                        )}
                        {!loading && payments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No hay movimientos registrados.</TableCell>
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
