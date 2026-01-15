"use client"

import React, { useEffect, useState } from "react"
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
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/currency"
import { Archive, Play, Pause, XCircle } from "lucide-react"

interface Subscription {
    id: number
    product: number
    product_name: string
    supplier: number
    supplier_name: string
    start_date: string
    end_date?: string
    next_payment_date?: string
    amount: string
    currency: string
    status: 'ACTIVE' | 'PAUSED' | 'CANCELLED' | 'EXPIRED'
    recurrence_period: string
    notes?: string
}

export function SubscriptionList() {
    const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
    const [loading, setLoading] = useState(true)

    const fetchSubscriptions = async () => {
        setLoading(true)
        try {
            const response = await api.get('/inventory/subscriptions/')
            const data = response.data.results || response.data
            setSubscriptions(data)
        } catch (error) {
            console.error("Failed to fetch subscriptions", error)
            toast.error("Error al cargar las suscripciones.")
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchSubscriptions()
    }, [])

    const handleStatusChange = async (subscription: Subscription, newStatus: string) => {
        try {
            await api.patch(`/inventory/subscriptions/${subscription.id}/`, { status: newStatus })
            toast.success("Estado actualizado correctamente")
            fetchSubscriptions()
        } catch (error) {
            console.error("Error updating status", error)
            toast.error("Error al actualizar estado")
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'ACTIVE':
                return <Badge className="bg-emerald-500 hover:bg-emerald-600">Activa</Badge>
            case 'PAUSED':
                return <Badge variant="secondary" className="bg-amber-100 text-amber-800">Pausada</Badge>
            case 'CANCELLED':
                return <Badge variant="destructive">Cancelada</Badge>
            case 'EXPIRED':
                return <Badge variant="outline" className="text-muted-foreground border-muted-foreground">Vencida</Badge>
            default:
                return <Badge variant="outline">{status}</Badge>
        }
    }

    const getRecurrenceLabel = (period: string) => {
        const map: Record<string, string> = {
            'WEEKLY': 'Semanal',
            'MONTHLY': 'Mensual',
            'QUARTERLY': 'Trimestral',
            'SEMIANNUAL': 'Semestral',
            'ANNUAL': 'Anual'
        }
        return map[period] || period
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Suscripciones Activas</h3>
            </div>

            <div className="rounded-xl border shadow-sm overflow-hidden bg-card">
                <Table>
                    <TableHeader className="bg-muted/30">
                        <TableRow>
                            <TableHead>Producto / Servicio</TableHead>
                            <TableHead>Proveedor</TableHead>
                            <TableHead>Frecuencia</TableHead>
                            <TableHead>Próximo Pago</TableHead>
                            <TableHead className="text-right">Monto</TableHead>
                            <TableHead className="text-center">Estado</TableHead>
                            <TableHead className="w-[120px] text-center">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {subscriptions.map((sub) => (
                            <TableRow key={sub.id} className="group hover:bg-muted/20 transition-colors">
                                <TableCell className="font-medium">
                                    {sub.product_name}
                                </TableCell>
                                <TableCell>{sub.supplier_name}</TableCell>
                                <TableCell>
                                    <Badge variant="outline" className="text-xs font-normal">
                                        {getRecurrenceLabel(sub.recurrence_period)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {sub.next_payment_date ? (
                                        <div className="flex flex-col">
                                            <span className="text-sm font-medium">{new Date(sub.next_payment_date).toLocaleDateString()}</span>
                                            {/* Logic to show days remaining could go here */}
                                        </div>
                                    ) : '-'}
                                </TableCell>
                                <TableCell className="text-right font-bold tabular-nums">
                                    {formatCurrency(Number(sub.amount))}
                                </TableCell>
                                <TableCell className="text-center">
                                    {getStatusBadge(sub.status)}
                                </TableCell>
                                <TableCell>
                                    <div className="flex justify-center gap-1">
                                        {sub.status === 'ACTIVE' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                                onClick={() => handleStatusChange(sub, 'PAUSED')}
                                                title="Pausar"
                                            >
                                                <Pause className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {sub.status === 'PAUSED' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                                onClick={() => handleStatusChange(sub, 'ACTIVE')}
                                                title="Reanudar"
                                            >
                                                <Play className="h-4 w-4" />
                                            </Button>
                                        )}
                                        {sub.status !== 'CANCELLED' && sub.status !== 'EXPIRED' && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-destructive hover:text-destructive hover:bg-red-50"
                                                onClick={() => {
                                                    if (confirm('¿Cancelar esta suscripción permanentemente?'))
                                                        handleStatusChange(sub, 'CANCELLED')
                                                }}
                                                title="Cancelar"
                                            >
                                                <XCircle className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                        {loading && (
                            <TableRow><TableCell colSpan={7} className="text-center py-10">Cargando suscripciones...</TableCell></TableRow>
                        )}
                        {!loading && subscriptions.length === 0 && (
                            <TableRow><TableCell colSpan={7} className="text-center py-10 italic text-muted-foreground">No hay suscripciones activas.</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
