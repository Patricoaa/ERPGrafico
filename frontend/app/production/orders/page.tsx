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

interface WorkOrder {
    id: number
    number: string
    description: string
    status: string
    start_date: string
    due_date: string
}

export default function WorkOrdersPage() {
    const [orders, setOrders] = useState<WorkOrder[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchOrders = async () => {
            try {
                const response = await api.get('/production/orders/')
                setOrders(response.data.results || response.data)
            } catch (error) {
                console.error("Failed to fetch works orders", error)
            } finally {
                setLoading(false)
            }
        }
        fetchOrders()
    }, [])

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'PLANNED': return 'secondary'
            case 'IN_PROGRESS': return 'default'
            case 'FINISHED': return 'outline' // Green-ish usually but outline for now
            default: return 'destructive'
        }
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Ordenes de Trabajo (OT)</h2>
                <div className="flex items-center space-x-2">
                    <Button>Nueva OT</Button>
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Número</TableHead>
                            <TableHead>Descripción</TableHead>
                            <TableHead>Estado</TableHead>
                            <TableHead>Fecha Inicio</TableHead>
                            <TableHead>Fecha Entrega</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {orders.map((order) => (
                            <TableRow key={order.id}>
                                <TableCell className="font-medium">OT-{order.number}</TableCell>
                                <TableCell>{order.description}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusColor(order.status) as any}>
                                        {order.status}
                                    </Badge>
                                </TableCell>
                                <TableCell>{order.start_date || '-'}</TableCell>
                                <TableCell>{order.due_date || '-'}</TableCell>
                                <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">Gestionar</Button>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center">Cargando OTs...</TableCell>
                            </TableRow>
                        )}
                        {!loading && orders.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center">No hay OTs registradas.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
