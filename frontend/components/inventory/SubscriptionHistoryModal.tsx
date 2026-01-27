"use client"

import { useState, useEffect } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Loader2,
    History,
    TrendingUp,
    FileText,
    BarChart3,
    LayoutDashboard,
    Calendar,
    DollarSign
} from "lucide-react"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from "@/components/ui/data-table-cells"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend
} from 'recharts'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { OrderCommandCenter } from "@/components/orders/OrderCommandCenter"

interface SubscriptionHistoryModalProps {
    subscriptionId: number | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface PriceHistoryEntry {
    date: string
    unit_cost: number
    order_number: string
}

interface OrderHistoryEntry {
    id: number
    number: string
    display_id: string
    date: string
    status: string
    total: number
    receiving_status: string
}

interface SubscriptionHistory {
    orders: OrderHistoryEntry[]
    price_history: PriceHistoryEntry[]
    product_name: string
    supplier_name: string
}

export function SubscriptionHistoryModal({ subscriptionId, open, onOpenChange }: SubscriptionHistoryModalProps) {
    const [data, setData] = useState<SubscriptionHistory | null>(null)
    const [loading, setLoading] = useState(false)
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)

    useEffect(() => {
        if (open && subscriptionId) {
            fetchHistory()
        }
    }, [open, subscriptionId])

    const fetchHistory = async () => {
        setLoading(true)
        try {
            const res = await api.get(`/inventory/subscriptions/${subscriptionId}/history/`)
            setData(res.data)
        } catch (error) {
            console.error("Error fetching subscription history:", error)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                    <DialogHeader className="p-6 pb-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <History className="h-5 w-5 text-primary" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl">Historial de Suscripción</DialogTitle>
                                    {data && (
                                        <p className="text-sm text-muted-foreground font-medium">
                                            {data.product_name} • {data.supplier_name}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground animate-pulse">Cargando historial...</p>
                        </div>
                    ) : !data ? (
                        <div className="flex-1 flex items-center justify-center py-20">
                            <p className="text-muted-foreground">Error al cargar datos.</p>
                        </div>
                    ) : (
                        <Tabs defaultValue="prices" className="flex-1 flex flex-col overflow-hidden">
                            <div className="px-6 border-b">
                                <TabsList className="bg-transparent h-12 w-full justify-start gap-6 rounded-none p-0">
                                    <TabsTrigger value="prices" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2">
                                        <TrendingUp className="h-4 w-4 mr-2" />
                                        Evolución de Costos
                                    </TabsTrigger>
                                    <TabsTrigger value="orders" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2">
                                        <FileText className="h-4 w-4 mr-2" />
                                        Órdenes de Compra (OCS)
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 overflow-auto p-6">
                                {/* PRICES TAB */}
                                <TabsContent value="prices" className="mt-0 space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <Card className="bg-blue-50/30 border-blue-100">
                                            <CardContent className="pt-4">
                                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Último Costo</p>
                                                <div className="flex items-baseline gap-2">
                                                    <DataCell.Currency value={data.price_history[0]?.unit_cost || 0} className="text-2xl font-black text-blue-900 text-left" />
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-amber-50/30 border-amber-100">
                                            <CardContent className="pt-4">
                                                <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">OCS Totales</p>
                                                <div className="flex items-baseline gap-2">
                                                    <p className="text-2xl font-black text-amber-900">{data.orders.length}</p>
                                                    <span className="text-xs text-amber-600">documentos</span>
                                                </div>
                                            </CardContent>
                                        </Card>
                                        <Card className="bg-emerald-50/30 border-emerald-100">
                                            <CardContent className="pt-4">
                                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Estado Actual</p>
                                                <Badge variant="success" className="mt-1">ACTIVA</Badge>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <div className="h-[300px] w-full bg-white rounded-xl border p-4 shadow-sm">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <AreaChart data={[...data.price_history].reverse()}>
                                                <defs>
                                                    <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                    </linearGradient>
                                                </defs>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                                <XAxis
                                                    dataKey="date"
                                                    tickFormatter={(str) => format(new Date(str), 'MMM d')}
                                                    fontSize={10}
                                                    tickMargin={10}
                                                    stroke="#94a3b8"
                                                />
                                                <YAxis fontSize={10} stroke="#94a3b8" tickFormatter={(val) => `$${val.toLocaleString()}`} />
                                                <RechartsTooltip
                                                    labelFormatter={(val) => format(new Date(val), 'PPP', { locale: es })}
                                                    formatter={(val: number | undefined) => [val !== undefined ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val) : '---', 'Costo Unitario']}
                                                    contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                                />
                                                <Area type="monotone" name="Costo Unitario" dataKey="unit_cost" stroke="#3b82f6" fillOpacity={1} fill="url(#colorCost)" strokeWidth={3} />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    </div>

                                    <div className="rounded-xl border shadow-sm overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                    <TableHead className="text-[10px] font-bold uppercase">Fecha</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase">N° OCS</TableHead>
                                                    <TableHead className="text-right text-[10px] font-bold uppercase">Costo Unitario</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {data.price_history.map((entry, i) => (
                                                    <TableRow key={i} className="hover:bg-primary/5 transition-colors">
                                                        <TableCell className="text-xs font-medium">
                                                            {format(new Date(entry.date), "dd/MM/yyyy", { locale: es })}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline" className="font-mono text-[10px] font-bold">
                                                                OCS-{entry.order_number}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <DataCell.Currency value={entry.unit_cost} className="text-right font-black text-blue-600" />
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {data.price_history.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={3} className="text-center py-10 text-muted-foreground italic text-sm">
                                                            No hay registros de costos procesados.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                {/* ORDERS TAB */}
                                <TabsContent value="orders" className="mt-0">
                                    <div className="rounded-xl border shadow-sm overflow-hidden">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/50 hover:bg-muted/50">
                                                    <TableHead className="text-[10px] font-bold uppercase">Documento</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase">Fecha</TableHead>
                                                    <TableHead className="text-[10px] font-bold uppercase">Estado</TableHead>
                                                    <TableHead className="text-right text-[10px] font-bold uppercase">Monto Total</TableHead>
                                                    <TableHead className="text-center text-[10px] font-bold uppercase">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {data.orders.map((order) => (
                                                    <TableRow key={order.id} className="hover:bg-primary/5 transition-colors">
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-sm">{order.display_id}</span>
                                                                <span className="text-[10px] text-muted-foreground font-mono">ID: {order.id}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-xs">
                                                            {format(new Date(order.date), "dd/MM/yyyy")}
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant={order.status === 'PAID' ? 'success' : 'secondary'} className="text-[10px] font-bold uppercase">
                                                                {order.status}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <DataCell.Currency value={order.total} className="text-right font-black" />
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-8 rounded-full gap-2 px-3 border-primary/20 hover:bg-primary hover:text-white"
                                                                onClick={() => setSelectedOrderId(order.id)}
                                                            >
                                                                <LayoutDashboard className="h-4 w-4" />
                                                                Gestionar
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {data.orders.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic text-sm">
                                                            No se encontraron órdenes de compra asociadas.
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>
                            </div>
                        </Tabs>
                    )}
                </DialogContent>
            </Dialog>

            <OrderCommandCenter
                orderId={selectedOrderId}
                type="purchase"
                open={selectedOrderId !== null}
                onOpenChange={(open) => {
                    if (!open) setSelectedOrderId(null)
                }}
                onActionSuccess={() => {
                    fetchHistory()
                }}
            />
        </>
    )
}
