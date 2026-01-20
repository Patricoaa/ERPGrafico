"use client"

import { useState, useEffect, useMemo } from "react"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Loader2,
    Activity as TimelineIcon,
    History,
    TrendingUp,
    TrendingDown,
    Minus,
    Package,
    ArrowUpRight,
    ArrowDownRight,
    Search
} from "lucide-react"
import {
    ResponsiveContainer,
    ComposedChart,
    Line,
    Area,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ReferenceLine
} from "recharts"
import api from "@/lib/api"
import { format, parseISO } from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency, cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PriceHistoryDialogProps {
    productId: number | null
    productName: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

interface TimelineEntry {
    date: string
    sale_price: number
    cost_price: number
    stock_level: number
    in_qty: number
    out_qty: number
    events: any[]
}

export function PriceHistoryDialog({ productId, productName, open, onOpenChange }: PriceHistoryDialogProps) {
    const [data, setData] = useState<TimelineEntry[]>([])
    const [loading, setLoading] = useState(false)
    const [visibility, setVisibility] = useState({
        sale_price: true,
        cost_price: true,
        stock_level: true,
        moves: true
    })

    useEffect(() => {
        if (open && productId) {
            fetchTimeline()
        }
    }, [open, productId])

    const fetchTimeline = async () => {
        setLoading(true)
        try {
            const res = await api.get(`/inventory/products/${productId}/timeline/`)
            setData(res.data)
        } catch (error) {
            console.error("Error fetching timeline:", error)
        } finally {
            setLoading(false)
        }
    }

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const date = parseISO(label)
            const item = data.find(d => d.date === label)

            return (
                <div className="bg-background border rounded-lg shadow-xl p-3 min-w-[200px] z-50">
                    <p className="text-[10px] font-bold uppercase text-muted-foreground mb-2 border-b pb-1">
                        {format(date, "EEEE dd 'de' MMMM, yyyy", { locale: es })}
                    </p>
                    <div className="space-y-2">
                        {payload.map((entry: any, index: number) => (
                            <div key={index} className="flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2">
                                    <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                                    <span className="text-xs font-medium text-muted-foreground">{entry.name}</span>
                                </div>
                                <span className="text-xs font-bold">
                                    {entry.name.includes("Precio") || entry.name.includes("Costo")
                                        ? formatCurrency(entry.value)
                                        : entry.value.toLocaleString('es-CL')}
                                </span>
                            </div>
                        ))}
                    </div>

                    {item?.events && item.events.length > 0 && (
                        <div className="mt-3 pt-2 border-t space-y-2">
                            <p className="text-[9px] font-bold text-muted-foreground uppercase">Eventos del día:</p>
                            {item.events.map((ev: any, i: number) => (
                                <div key={i} className="text-[10px] bg-muted/30 p-1.5 rounded border-l-2 border-primary">
                                    <span className="font-bold flex items-center gap-1 mb-0.5">
                                        {ev.type === 'price_change' ? <TrendingUp className="h-2.5 w-2.5" /> : <Package className="h-2.5 w-2.5" />}
                                        {ev.type === 'price_change' ? 'Cambio de Precio' : (ev.move_type === 'IN' ? 'Entrada' : 'Salida')}
                                    </span>
                                    <p className="text-muted-foreground line-clamp-2">{ev.description || ev.reference}</p>
                                    {ev.user && <p className="text-[8px] italic mt-1 text-right">por {ev.user}</p>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )
        }
        return null
    }

    const chartData = useMemo(() => {
        return data.map(d => ({
            ...d,
            formattedDate: format(parseISO(d.date), "dd/MM"),
        }))
    }, [data])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-0">
                    <div className="flex items-center justify-between border-b pb-4">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                                <TimelineIcon className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                                <DialogTitle className="text-xl">Analítica de Producto</DialogTitle>
                                {productName && (
                                    <p className="text-sm text-muted-foreground font-medium">
                                        {productName}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-6 pr-4">
                            <div className="flex flex-col items-center gap-1.5">
                                <Label htmlFor="show-prices" className="text-[10px] font-bold text-muted-foreground uppercase">Monetario</Label>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 rounded-full bg-[#0ea5e9]" />
                                        <Switch
                                            id="show-sale"
                                            checked={visibility.sale_price}
                                            onCheckedChange={(c) => setVisibility(v => ({ ...v, sale_price: c }))}
                                            className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 rounded-full bg-[#f43f5e]" />
                                        <Switch
                                            id="show-cost"
                                            checked={visibility.cost_price}
                                            onCheckedChange={(c) => setVisibility(v => ({ ...v, cost_price: c }))}
                                            className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="w-[1px] h-8 bg-border" />
                            <div className="flex flex-col items-center gap-1.5">
                                <Label htmlFor="show-stock" className="text-[10px] font-bold text-muted-foreground uppercase">Inventario</Label>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 rounded-full bg-[#10b981]" />
                                        <Switch
                                            id="show-stock"
                                            checked={visibility.stock_level}
                                            onCheckedChange={(c) => setVisibility(v => ({ ...v, stock_level: c }))}
                                            className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <div className="h-2 w-2 rounded-sm bg-[#cbd5e1]" />
                                        <Switch
                                            id="show-moves"
                                            checked={visibility.moves}
                                            onCheckedChange={(c) => setVisibility(v => ({ ...v, moves: c }))}
                                            className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-hidden p-6 gap-6 grid grid-cols-1 lg:grid-cols-4">
                    <div className="lg:col-span-3 flex flex-col gap-4">
                        {loading ? (
                            <div className="flex-1 flex flex-col items-center justify-center bg-muted/10 rounded-2xl border border-dashed">
                                <Loader2 className="h-10 w-10 animate-spin text-primary/50" />
                                <p className="mt-4 text-sm text-muted-foreground animate-pulse">Analizando serie temporal...</p>
                            </div>
                        ) : data.length === 0 ? (
                            <div className="flex-1 flex flex-col items-center justify-center bg-muted/5 rounded-2xl border border-dashed">
                                <div className="h-16 w-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                    <Search className="h-8 w-8 text-muted-foreground/50" />
                                </div>
                                <p className="text-muted-foreground font-medium">No hay datos históricos disponibles.</p>
                            </div>
                        ) : (
                            <div className="flex-1 bg-card border rounded-2xl shadow-sm p-4 pt-8">
                                <ResponsiveContainer width="100%" height="100%">
                                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorStock" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                                                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                        <XAxis
                                            dataKey="date"
                                            tickFormatter={(val) => format(parseISO(val), "dd/MM")}
                                            stroke="#94a3b8"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                            padding={{ left: 10, right: 10 }}
                                        />
                                        <YAxis
                                            yAxisId="left"
                                            stroke="#94a3b8"
                                            fontSize={11}
                                            tickFormatter={(val) => `$${val.toLocaleString()}`}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <YAxis
                                            yAxisId="right"
                                            orientation="right"
                                            stroke="#94a3b8"
                                            fontSize={11}
                                            tickLine={false}
                                            axisLine={false}
                                        />
                                        <Tooltip content={<CustomTooltip />} />

                                        {/* Cumulative Stock Area */}
                                        {visibility.stock_level && (
                                            <Area
                                                yAxisId="right"
                                                type="stepAfter"
                                                dataKey="stock_level"
                                                name="Stock Nivel"
                                                stroke="#10b981"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorStock)"
                                                animationDuration={1500}
                                            />
                                        )}

                                        {/* In/Out Bars */}
                                        {visibility.moves && (
                                            <>
                                                <Bar yAxisId="right" dataKey="in_qty" name="Entradas" fill="#cbd5e1" radius={[2, 2, 0, 0]} barSize={20} />
                                                <Bar yAxisId="right" dataKey="out_qty" name="Salidas" fill="#94a3b8" radius={[2, 2, 0, 0]} barSize={20} />
                                            </>
                                        )}

                                        {/* Prices Lines */}
                                        {visibility.sale_price && (
                                            <Line
                                                yAxisId="left"
                                                type="monotone"
                                                dataKey="sale_price"
                                                name="Precio Venta"
                                                stroke="#0ea5e9"
                                                strokeWidth={3}
                                                dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
                                                activeDot={{ r: 6, strokeWidth: 0 }}
                                                animationDuration={1500}
                                            />
                                        )}
                                        {visibility.cost_price && (
                                            <Line
                                                yAxisId="left"
                                                type="monotone"
                                                dataKey="cost_price"
                                                name="Costo Ponderado"
                                                stroke="#f43f5e"
                                                strokeWidth={2}
                                                strokeDasharray="5 5"
                                                dot={{ r: 3, strokeWidth: 2, fill: "#fff" }}
                                                activeDot={{ r: 5, strokeWidth: 0 }}
                                                animationDuration={1500}
                                            />
                                        )}
                                    </ComposedChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-sky-600 uppercase tracking-tighter">Precio Venta (Actual)</span>
                                    <ArrowUpRight className="h-3 w-3 text-sky-400" />
                                </div>
                                <p className="text-xl font-black text-sky-950">
                                    {data.length > 0 ? formatCurrency(data[data.length - 1].sale_price) : '$0'}
                                </p>
                            </div>
                            <div className="bg-rose-50/50 border border-rose-100 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-rose-600 uppercase tracking-tighter">Costo Ponderado</span>
                                    <TrendingDown className="h-3 w-3 text-rose-400" />
                                </div>
                                <p className="text-xl font-black text-rose-950">
                                    {data.length > 0 ? formatCurrency(data[data.length - 1].cost_price) : '$0'}
                                </p>
                            </div>
                            <div className="bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-tighter">Stock Actual</span>
                                    <Package className="h-3 w-3 text-emerald-400" />
                                </div>
                                <p className="text-xl font-black text-emerald-950">
                                    {data.length > 0 ? data[data.length - 1].stock_level.toLocaleString() : '0'}
                                </p>
                            </div>
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">Margen Bruto (%)</span>
                                    <div className="h-2 w-2 rounded-full bg-slate-300" />
                                </div>
                                {data.length > 0 && data[data.length - 1].sale_price > 0 ? (
                                    <p className="text-xl font-black text-slate-700">
                                        {(((data[data.length - 1].sale_price - data[data.length - 1].cost_price) / data[data.length - 1].sale_price) * 100).toFixed(1)}%
                                    </p>
                                ) : <p className="text-xl font-black text-slate-700">0%</p>}
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col bg-muted/10 rounded-2xl border overflow-hidden h-full">
                        <div className="bg-muted/30 p-4 border-b flex items-center gap-2">
                            <History className="h-4 w-4 text-muted-foreground" />
                            <span className="text-xs font-bold uppercase tracking-tight">Historial de Eventos</span>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="p-4 space-y-4">
                                {data.slice().reverse().map((day, dIdx) => (
                                    day.events.length > 0 && (
                                        <div key={dIdx} className="space-y-1.5">
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <div className="h-px bg-border flex-1" />
                                                <span className="text-[9px] font-bold text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full uppercase">
                                                    {format(parseISO(day.date), "MMM dd", { locale: es })}
                                                </span>
                                                <div className="h-px bg-border flex-1" />
                                            </div>
                                            {day.events.slice().reverse().map((ev, eIdx) => (
                                                <div key={eIdx} className="group relative pl-4 border-l-2 border-primary/20 hover:border-primary transition-colors py-1">
                                                    <div className="absolute left-[-5px] top-[10px] h-2 w-2 rounded-full bg-background border-2 border-primary group-hover:bg-primary transition-colors" />
                                                    <p className="text-[11px] font-bold flex items-center justify-between">
                                                        {ev.type === 'price_change' ? 'Cambio Precio' : (ev.qty > 0 ? 'Entrada' : 'Salida')}
                                                        <span className="text-[9px] font-normal text-muted-foreground">
                                                            {ev.qty ? `${ev.qty > 0 ? '+' : ''}${ev.qty}` : ev.sale_price}
                                                        </span>
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                                                        {ev.description || ev.reference || 'Cambio manual'}
                                                    </p>
                                                    {ev.user && (
                                                        <p className="text-[8px] text-primary/60 font-medium uppercase mt-0.5">
                                                            @{ev.user}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
