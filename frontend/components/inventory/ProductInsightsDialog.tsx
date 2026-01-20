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
    TrendingDown,
    Minus,
    BarChart3,
    ArrowRightLeft,
    Factory,
    DollarSign,
    ArrowUpRight,
    ArrowDownRight,
    Search
} from "lucide-react"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from "@/components/ui/data-table-cells"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    AreaChart,
    Area
} from 'recharts'
import { Card, CardContent } from "@/components/ui/card"

interface ProductInsightsDialogProps {
    productId: number | null
    productName: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface PriceHistoryEntry {
    date: string
    sale_price: number
    cost_price: number
    user: string
}

interface KardexEntry {
    date: string
    type: string
    quantity: number
    warehouse: string
    description: string
    uom: string
}

interface ProductionUsage {
    date: string
    ot_number: string
    quantity: number
    description: string
}

interface SalesAnalysis {
    avg_price: number
    avg_cost: number
    total_sold: number
    total_revenue: number
    total_cost_basis: number
}

interface ProductInsights {
    price_history: PriceHistoryEntry[]
    kardex: KardexEntry[]
    sales_analysis: SalesAnalysis
    production_usage: ProductionUsage[]
}

export function ProductInsightsDialog({ productId, productName, open, onOpenChange }: ProductInsightsDialogProps) {
    const [data, setData] = useState<ProductInsights | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open && productId) {
            fetchInsights()
        }
    }, [open, productId])

    const fetchInsights = async () => {
        setLoading(true)
        try {
            const res = await api.get(`/inventory/products/${productId}/insights/`)
            setData(res.data)
        } catch (error) {
            console.error("Error fetching product insights:", error)
        } finally {
            setLoading(false)
        }
    }

    if (!open) return null

    const margin = data ? data.sales_analysis.total_revenue - data.sales_analysis.total_cost_basis : 0
    const marginPercent = data && data.sales_analysis.total_revenue > 0
        ? (margin / data.sales_analysis.total_revenue) * 100
        : 0

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-primary/10 rounded-lg">
                                <BarChart3 className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl">Insights del Producto</DialogTitle>
                                {productName && (
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {productName}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center py-20 gap-4">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                        <p className="text-sm text-muted-foreground animate-pulse">Analizando datos del producto...</p>
                    </div>
                ) : !data ? (
                    <div className="flex-1 flex items-center justify-center py-20">
                        <p className="text-muted-foreground">Error al cargar datos.</p>
                    </div>
                ) : (
                    <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden">
                        <div className="px-6 border-b">
                            <TabsList className="bg-transparent h-12 w-full justify-start gap-6 rounded-none p-0">
                                <TabsTrigger value="overview" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2">Resumen</TabsTrigger>
                                <TabsTrigger value="history" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-primary/80">
                                    <History className="h-4 w-4 mr-2" />
                                    Historial Precios
                                </TabsTrigger>
                                <TabsTrigger value="kardex" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-primary/80">
                                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                                    Kardex
                                </TabsTrigger>
                                <TabsTrigger value="production" className="border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent rounded-none px-2 text-primary/80">
                                    <Factory className="h-4 w-4 mr-2" />
                                    Producción
                                </TabsTrigger>
                            </TabsList>
                        </div>

                        <div className="flex-1 overflow-auto p-6">
                            {/* OVERVIEW TAB */}
                            <TabsContent value="overview" className="mt-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <Card className="bg-emerald-50/30 border-emerald-100">
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Ventas Totales</p>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-2xl font-black text-emerald-900">{data.sales_analysis.total_sold}</p>
                                                <span className="text-xs text-emerald-600">uds</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-blue-50/30 border-blue-100">
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">Ingresos (Neto)</p>
                                            <DataCell.Currency value={data.sales_analysis.total_revenue} className="text-2xl font-black text-blue-900 text-left" />
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-amber-50/30 border-amber-100">
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Margen Bruto</p>
                                            <div className="flex items-baseline gap-2">
                                                <DataCell.Currency value={margin} className="text-2xl font-black text-amber-900 text-left" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className={marginPercent >= 20 ? "bg-indigo-50/30 border-indigo-100" : "bg-rose-50/30 border-rose-100"}>
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">% de Margen</p>
                                            <div className="flex items-center gap-2">
                                                <p className={`text-2xl font-black ${marginPercent >= 20 ? 'text-indigo-900' : 'text-rose-900'}`}>
                                                    {marginPercent.toFixed(1)}%
                                                </p>
                                                {marginPercent >= 20 ? <ArrowUpRight className="h-5 w-5 text-indigo-600" /> : <ArrowDownRight className="h-5 w-5 text-rose-600" />}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <TrendingUp className="h-4 w-4 text-primary" />
                                            Análisis de Precios Unitarios
                                        </h4>
                                        <div className="rounded-xl border p-4 space-y-3 bg-slate-50/50">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">Precio Promedio de Venta:</span>
                                                <DataCell.Currency value={data.sales_analysis.avg_price} className="font-bold" />
                                            </div>
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs text-muted-foreground">Costo Promedio Real:</span>
                                                <DataCell.Currency value={data.sales_analysis.avg_cost} className="font-bold" />
                                            </div>
                                            <div className="h-px bg-border pt-2" />
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold">Ganancia por Unidad:</span>
                                                <DataCell.Currency value={data.sales_analysis.avg_price - data.sales_analysis.avg_cost} className="font-black text-indigo-600" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Factory className="h-4 w-4 text-primary" />
                                            Consumo en Producción
                                        </h4>
                                        <div className="rounded-xl border p-4 bg-slate-50/50">
                                            {data.production_usage.length > 0 ? (
                                                <div className="space-y-3">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-xs text-muted-foreground">Total OTs que usaron este producto:</span>
                                                        <span className="font-bold text-lg">{data.production_usage.length}</span>
                                                    </div>
                                                    <div className="text-[10px] text-muted-foreground italic">
                                                        * Muestra las últimas 20 utilizaciones en el taller.
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="py-2 text-center text-xs text-muted-foreground italic">
                                                    No se ha registrado uso en producción.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            {/* HISTORY TAB */}
                            <TabsContent value="history" className="mt-0 space-y-6">
                                <div className="h-[250px] w-full bg-white rounded-xl border p-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={[...data.price_history].reverse()}>
                                            <defs>
                                                <linearGradient id="colorSale" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                            <XAxis
                                                dataKey="date"
                                                tickFormatter={(str) => format(new Date(str), 'MMM d')}
                                                fontSize={10}
                                                tickMargin={10}
                                            />
                                            <YAxis fontSize={10} />
                                            <RechartsTooltip
                                                labelFormatter={(val) => format(new Date(val), 'PPP', { locale: es })}
                                                formatter={(val: number) => [new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(val), '']}
                                            />
                                            <Legend verticalAlign="top" height={36} />
                                            <Area type="monotone" name="Precio Venta" dataKey="sale_price" stroke="#3b82f6" fillOpacity={1} fill="url(#colorSale)" strokeWidth={2} />
                                            <Area type="monotone" name="Costo" dataKey="cost_price" stroke="#ef4444" fillOpacity={1} fill="url(#colorCost)" strokeWidth={2} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Usuario</TableHead>
                                                <TableHead>Precio de Venta</TableHead>
                                                <TableHead>Costo Ponderado</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.price_history.map((entry, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-xs">
                                                        {format(new Date(entry.date), "dd/MM/yyyy HH:mm", { locale: es })}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="font-normal text-[10px]">
                                                            {entry.user}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <DataCell.Currency value={entry.sale_price} className="text-left font-bold" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <DataCell.Currency value={entry.cost_price} className="text-left text-muted-foreground" />
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            {/* KARDEX TAB */}
                            <TabsContent value="kardex" className="mt-0">
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead>Cantidad</TableHead>
                                                <TableHead>Bodega</TableHead>
                                                <TableHead>Motivo / Doc</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.kardex.map((move, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-xs">
                                                        {format(new Date(move.date), "dd/MM/yyyy")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge
                                                            variant={move.type === 'IN' ? 'success' : move.type === 'OUT' ? 'destructive' : 'outline'}
                                                            className="text-[10px] uppercase font-bold"
                                                        >
                                                            {move.type}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <DataCell.Number value={move.quantity} className="text-left" suffix={move.uom} decimals={2} />
                                                    </TableCell>
                                                    <TableCell className="text-xs">{move.warehouse}</TableCell>
                                                    <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]" title={move.description}>
                                                        {move.description || "-"}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {data.kardex.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-10 text-muted-foreground italic">
                                                        Sin movimientos registrados
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </TabsContent>

                            {/* PRODUCTION TAB */}
                            <TabsContent value="production" className="mt-0">
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>N° OT</TableHead>
                                                <TableHead>Cantidad Consumida</TableHead>
                                                <TableHead>Descripción</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.production_usage.map((usage, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-xs">
                                                        {format(new Date(usage.date), "dd/MM/yyyy")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="indigo" className="font-bold">
                                                            OT-{usage.ot_number}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <DataCell.Number value={usage.quantity} className="text-left" decimals={2} />
                                                    </TableCell>
                                                    <TableCell className="text-xs text-muted-foreground">
                                                        {usage.description}
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {data.production_usage.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground italic">
                                                        Este producto no ha sido utilizado como material en producción.
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
    )
}
