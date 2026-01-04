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
import { Eye } from "lucide-react"
import api from "@/lib/api"
import { PaymentForm } from "@/components/forms/PaymentForm"
import { Badge } from "@/components/ui/badge"
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
    const [viewingTransaction, setViewingTransaction] = useState<{ type: any, id: number | string, view?: 'details' | 'history' } | null>(null)

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
                            <TableHead>Fecha</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Documento</TableHead>
                            <TableHead>Entidad</TableHead>
                            <TableHead>Caja/Banco</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell>{new Date(payment.date).toLocaleDateString()}</TableCell>
                                <TableCell className="font-mono text-xs">{payment.code}</TableCell>
                                <TableCell>
                                    <Badge variant={payment.payment_type === 'INBOUND' ? 'default' : 'destructive'}>
                                        {payment.payment_type === 'INBOUND' ? 'Ingreso' : 'Egreso'}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {payment.document_info ? (
                                        <button
                                            onClick={() => setViewingTransaction({ type: payment.document_info!.type, id: payment.document_info!.id, view: 'details' })}
                                            className="text-blue-600 hover:underline text-[12px] font-medium text-left leading-tight"
                                        >
                                            {payment.document_info.label}
                                        </button>
                                    ) : (
                                        <span className="text-muted-foreground text-xs">{payment.reference || '-'}</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-sm">{payment.partner_name}</TableCell>
                                <TableCell className="text-sm">{payment.journal_name}</TableCell>
                                <TableCell className="text-right font-medium font-mono">${Number(payment.amount).toLocaleString()}</TableCell>
                                <TableCell>
                                    <div className="flex justify-center">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => {
                                                if (payment.document_info) {
                                                    setViewingTransaction({
                                                        type: payment.document_info.type,
                                                        id: payment.document_info.id,
                                                        view: 'details'
                                                    })
                                                }
                                            }}
                                            title="Ver Detalle"
                                            disabled={!payment.document_info}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center">Cargando movimientos...</TableCell>
                            </TableRow>
                        )}
                        {!loading && payments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center">No hay movimientos registrados.</TableCell>
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
                    view={viewingTransaction.view || "details"}
                />
            )}
        </div>
    )
}
