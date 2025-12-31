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
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"

interface Payment {
    id: number
    payment_type: string
    amount: string
    date: string
    reference: string
    partner_name: string
    journal_name: string
}

export default function PaymentsPage() {
    const [payments, setPayments] = useState<Payment[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPayments = async () => {
            try {
                const response = await api.get('/treasury/payments/')
                setPayments(response.data.results || response.data)
            } catch (error) {
                console.error("Failed to fetch payments", error)
            } finally {
                setLoading(false)
            }
        }
        fetchPayments()
    }, [])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Pagos y Cobros</h2>
                <div className="flex items-center space-x-2">
                    <Button>Registrar Pago</Button>
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Tipo</TableHead>
                            <TableHead>Referencia</TableHead>
                            <TableHead>Entidad</TableHead>
                            <TableHead>Caja/Banco</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {payments.map((payment) => (
                            <TableRow key={payment.id}>
                                <TableCell>{payment.date}</TableCell>
                                <TableCell>
                                    <Badge variant={payment.payment_type === 'INBOUND' ? 'default' : 'destructive'}>
                                        {payment.payment_type === 'INBOUND' ? 'Entrada' : 'Salida'}
                                    </Badge>
                                </TableCell>
                                <TableCell>{payment.reference}</TableCell>
                                <TableCell>{payment.partner_name}</TableCell>
                                <TableCell>{payment.journal_name}</TableCell>
                                <TableCell className="text-right font-medium">${Number(payment.amount).toLocaleString()}</TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center">Cargando pagos...</TableCell>
                            </TableRow>
                        )}
                        {!loading && payments.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center">No hay movimientos registrados.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
