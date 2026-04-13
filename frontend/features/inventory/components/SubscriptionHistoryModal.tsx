"use client"

import { useState, useEffect, useMemo } from "react"
import { BaseModal } from "@/components/shared/BaseModal"
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
    DollarSign,
    Receipt
} from "lucide-react"
import api from "@/lib/api"
import { EmptyState } from "@/components/shared/EmptyState"
import { format, isWithinInterval, startOfDay, endOfDay } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from "@/components/ui/data-table-cells"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    Cell
} from 'recharts'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useHubPanel } from "@/components/providers/HubPanelProvider"
import { DateRangeFilter } from "@/components/shared/DateRangeFilter"
import { translateStatus } from "@/lib/utils"

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

interface NoteHistoryEntry {
    id: number
    number: string
    display_id: string
    date: string
    status: string
    dte_type: string
    total: number
    purchase_order_number: string | null
}

interface SubscriptionHistory {
    orders: OrderHistoryEntry[]
    price_history: PriceHistoryEntry[]
    notes: NoteHistoryEntry[]
    product_name: string
    supplier_name: string
}

export function SubscriptionHistoryModal({ subscriptionId, open, onOpenChange }: SubscriptionHistoryModalProps) {
    const [data, setData] = useState<SubscriptionHistory | null>(null)
    const [loading, setLoading] = useState(false)
    const { openHub } = useHubPanel()
    const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date } | undefined>()

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

    const filteredPriceHistory = useMemo(() => {
        if (!data) return []
        let items = [...data.price_history].reverse()

        if (dateRange?.from) {
            const from = startOfDay(dateRange.from)
            const to = dateRange.to ? endOfDay(dateRange.to) : endOfDay(new Date())
            items = items.filter(item => {
                const itemDate = new Date(item.date)
                return isWithinInterval(itemDate, { start: from, end: to })
            })
        }

        return items
    }, [data, dateRange])

    if (!open) return null

    return (
        <>
            <BaseModal
                open={open}
                onOpenChange={onOpenChange}
                size="full"
                className="max-w-5xl"
                headerClassName="sr-only"
                title={`Historial de Suscripción: ${data?.product_name}`}
            >
                <div className="flex flex-col h-full overflow-hidden">
                    <div className="p-6 pb-2 border-b flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <History className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">Historial de Suscripción</h2>
                                {data && (
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {data.product_name} | {data.supplier_name}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

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
                        <Tabs defaultValue="historial" className="flex-1 flex flex-col overflow-hidden">
                            <div className="px-6 border-b">
                                <TabsList className="bg-transparent h-12 w-full justify-start gap-6 rounded-none p-0">
                                    <TabsTrigger value="historial" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 font-bold text-xs uppercase tracking-tight transition-all">
                                        <History className="h-4 w-4 mr-2" />
                                        Historial de Costos
                                    </TabsTrigger>
                                    <TabsTrigger value="orders" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 font-bold text-xs uppercase tracking-tight transition-all">
                                        <FileText className="h-4 w-4 mr-2" />
                                        Órdenes de Compra (OCS)
                                    </TabsTrigger>
                                    <TabsTrigger value="notes" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 font-bold text-xs uppercase tracking-tight transition-all">
                                        <Receipt className="h-4 w-4 mr-2" />
                                        Notas de Crédito / Débito
                                    </TabsTrigger>
                                </TabsList>
                            </div>

                            <div className="flex-1 overflow-auto p-6">
                                {/* HISTORIAL TAB */}
                                <TabsContent value="historial" className="mt-0 space-y-6">
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                            <Card className="bg-primary/10/30 border-primary/10 shadow-none">
                                                <CardContent className="p-4">
                                                    <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Último Precio</p>
                                                    <DataCell.Currency value={data.price_history[0]?.unit_cost || 0} className="text-2xl font-black text-primary text-left" />
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-warning/10/30 border-warning/10 shadow-none">
                                                <CardContent className="p-4">
                                                    <p className="text-[10px] font-bold text-warning uppercase tracking-wider">OCS Totales</p>
                                                    <div className="flex items-baseline gap-2">
                                                        <p className="text-2xl font-black text-warning">{data.orders.length}</p>
                                                        <span className="text-xs text-warning">documentos</span>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                            <Card className="bg-success/10/30 border-success/10 shadow-none">
                                                <CardContent className="p-4">
                                                    <p className="text-[10px] font-bold text-success uppercase tracking-wider">Estado Actual</p>
                                                    <div className="mt-1">
                                                        <StatusBadge status="SUCCESS" label="ACTIVA" />
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        </div>

                                        <div className="flex justify-end">
                                            <DateRangeFilter onRangeChange={setDateRange} label="Periodo para el gráfico" />
                                        </div>
                                    </div>

                                    <div className="h-[400px] w-full bg-white rounded-lg border p-6 shadow-sm">
                                        <ResponsiveContainer width="100%" height="100%">
                                            <BarChart data={filteredPriceHistory}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--muted)" />
                                                <XAxis
                                                    dataKey="date"
                                                    tickFormatter={(str) => format(new Date(str), 'MMM d', { locale: es })}
                                                    fontSize={10}
                                                    tickMargin={10}
                                                    stroke="var(--muted-foreground)"
                                                />
                                                <YAxis fontSize={10} stroke="var(--muted-foreground)" tickFormatter={(val) => `$${val.toLocaleString()}`} />
                                                <RechartsTooltip
                                                    labelFormatter={(val) => format(new Date(val), 'PPP', { locale: es })}
                                                    formatter={(val: number | undefined) => [val !== undefined ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val) : '---', 'Costo Unitario']}
                                                    contentStyle={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)', padding: '12px', backgroundColor: 'var(--popover)', color: 'var(--popover-foreground)' }}
                                                />
                                                <Bar
                                                    dataKey="unit_cost"
                                                    name="Precio"
                                                    fill="var(--primary)"
                                                    radius={[6, 6, 0, 0]}
                                                    barSize={40}
                                                >
                                                    {filteredPriceHistory.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--primary)' : 'var(--primary)'} fillOpacity={index === 0 ? 1 : 0.7} />
                                                    ))}
                                                </Bar>
                                            </BarChart>
                                        </ResponsiveContainer>
                                    </div>
                                    {filteredPriceHistory.length === 0 && (
                                        <EmptyState
                                            context="search"
                                            variant="compact"
                                            title="Sin datos"
                                            description="No hay datos para el periodo seleccionado."
                                        />
                                    )}
                                </TabsContent>

                                {/* ORDERS TAB */}
                                <TabsContent value="orders" className="mt-0">
                                    <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                                                    <TableHead className="text-[10px] font-black uppercase tracking-wider py-4">Documento</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-wider py-4">Fecha</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-wider py-4 text-center">Estado</TableHead>
                                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-wider py-4">Monto Total</TableHead>
                                                    <TableHead className="text-center text-[10px] font-black uppercase tracking-wider py-4">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {data.orders.map((order) => (
                                                    <TableRow key={order.id} className="hover:bg-primary/5 transition-colors group">
                                                        <TableCell>
                                                            <span className="font-black text-sm text-primary">{order.display_id}</span>
                                                        </TableCell>
                                                        <TableCell className="text-xs font-medium">
                                                            {format(new Date(order.date), "dd/MM/yyyy")}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex justify-center">
                                                                <StatusBadge 
                                                                    status={order.status === 'PAID' || order.status === 'RECEIVED' ? 'SUCCESS' : 'NEUTRAL'} 
                                                                    label={translateStatus(order.status)}
                                                                />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <DataCell.Currency value={order.total} className="text-right font-black" />
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-9 rounded-full gap-2 px-4 border-primary/20 hover:bg-primary hover:text-white transition-all shadow-sm"
                                                                onClick={() => openHub({
                                                                    orderId: order.id,
                                                                    type: 'purchase',
                                                                    onActionSuccess: fetchHistory
                                                                })}
                                                            >
                                                                <LayoutDashboard className="h-4 w-4" />
                                                                Gestionar
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {data.orders.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={5} className="py-12">
                                                            <EmptyState
                                                                context="search"
                                                                variant="compact"
                                                                title="Sin órdenes"
                                                                description="No se encontraron órdenes de compra para esta suscripción."
                                                            />
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </TabsContent>

                                {/* NOTES TAB */}
                                <TabsContent value="notes" className="mt-0">
                                    <div className="rounded-lg border shadow-sm overflow-hidden bg-card">
                                        <Table>
                                            <TableHeader>
                                                <TableRow className="bg-muted/30 hover:bg-muted/30 border-b">
                                                    <TableHead className="text-[10px] font-black uppercase tracking-wider py-4">Nota</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-wider py-4">OCS Relacionada</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-wider py-4">Fecha</TableHead>
                                                    <TableHead className="text-[10px] font-black uppercase tracking-wider py-4 text-center">Estado</TableHead>
                                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-wider py-4">Monto Total</TableHead>
                                                    <TableHead className="text-center text-[10px] font-black uppercase tracking-wider py-4">Acciones</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {data.notes.map((note) => (
                                                    <TableRow key={note.id} className="hover:bg-primary/5 transition-colors group">
                                                        <TableCell>
                                                            <div className="flex flex-col">
                                                                <span className="font-black text-sm text-primary">{note.display_id}</span>
                                                                <span className="text-[9px] text-muted-foreground font-bold uppercase">{note.dte_type.replace('_', ' ')}</span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[0.25rem] border border-border bg-muted/50 text-muted-foreground whitespace-nowrap font-mono">
                                                                OCS-{note.purchase_order_number}
                                                            </span>
                                                        </TableCell>
                                                        <TableCell className="text-xs font-medium">
                                                            {format(new Date(note.date), "dd/MM/yyyy")}
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <div className="flex justify-center">
                                                                <StatusBadge 
                                                                    status={note.status === 'PAID' || note.status === 'POSTED' ? 'SUCCESS' : 'NEUTRAL'} 
                                                                    label={translateStatus(note.status)}
                                                                />
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <DataCell.Currency value={note.total} className="text-right font-black" />
                                                        </TableCell>
                                                        <TableCell className="text-center">
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                className="h-9 rounded-full gap-2 px-4 border-primary/20 hover:bg-primary hover:text-white transition-all shadow-sm"
                                                                onClick={() => openHub({
                                                                    invoiceId: note.id,
                                                                    type: 'purchase',
                                                                    onActionSuccess: fetchHistory
                                                                })}
                                                            >
                                                                <LayoutDashboard className="h-4 w-4" />
                                                                Gestionar
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                                {data.notes.length === 0 && (
                                                    <TableRow>
                                                        <TableCell colSpan={6} className="py-12">
                                                            <EmptyState
                                                                context="search"
                                                                variant="compact"
                                                                title="Sin notas"
                                                                description="No se encontraron notas asociadas a este producto."
                                                            />
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
                </div>
            </BaseModal>

        </>
    )
}
