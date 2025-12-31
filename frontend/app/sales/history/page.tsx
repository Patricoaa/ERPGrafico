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
import api from "@/lib/api"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface SaleHistoryItem {
    id: number
    number: string
    customer_name: string
    date: string
    total: string
    status: string
}

export default function SalesHistoryPage() {
    const [sales, setSales] = useState<SaleHistoryItem[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchHistory = async () => {
            try {
                // Fetch all confirmed/paid sales
                const response = await api.get('/sales/orders/')
                setSales(response.data.results || response.data)
            } catch (error) {
                console.error("Failed to fetch sales history", error)
            } finally {
                setLoading(false)
            }
        }
        fetchHistory()
    }, [])

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <h2 className="text-3xl font-bold tracking-tight">Historial de Ventas</h2>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Fecha</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead>Estado</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {loading ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10">Cargando historial...</TableCell>
                            </TableRow>
                        ) : sales.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="text-center py-10">No hay ventas registradas.</TableCell>
                            </TableRow>
                        ) : sales.map((sale) => (
                            <TableRow key={sale.id}>
                                <TableCell className="font-medium">{sale.number}</TableCell>
                                <TableCell>{new Date(sale.date).toLocaleDateString()}</TableCell>
                                <TableCell>{sale.customer_name}</TableCell>
                                <TableCell className="text-right font-bold">${Number(sale.total).toLocaleString()}</TableCell>
                                <TableCell>
                                    <Badge variant={sale.status === 'PAID' ? 'default' : 'outline'}>
                                        {sale.status}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
