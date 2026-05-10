"use client"

import { FormSkeleton } from "@/components/shared"

import { useState, useEffect } from "react"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
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
    History,
    TrendingUp,
    BarChart3,
    ArrowRightLeft,
    Factory,
    ArrowUpRight,
    ArrowDownRight,
    Eye,
    LayoutDashboard
} from "lucide-react"
import api from "@/lib/api"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from "@/components/ui/data-table-cells"
import { formatEntityDisplay } from "@/lib/entity-registry"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { FormTabs, FormTabsContent } from "@/components/shared"
import { TransactionViewModal } from "@/components/shared/TransactionViewModal"
import { WorkOrderWizard } from "@/features/production/components/WorkOrderWizard"
import {
    ResponsiveContainer,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    AreaChart,
    Area
} from 'recharts'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface ProductInsightsModalProps {
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
    id: number
    display_id: string
    related_id: number
    related_type: string
    date: string
    type: string
    quantity: number
    unit_price?: number
    total_price?: number
    warehouse: string
    description: string
    uom: string
}

interface ProductionUsage {
    date: string
    ot_id: number
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

export function ProductInsightsModal({ productId, productName, open, onOpenChange }: ProductInsightsModalProps) {
    const [data, setData] = useState<ProductInsights | null>(null)
    const [loading, setLoading] = useState(false)
    const [activeTab, setActiveTab] = useState("overview")

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()

    const transactionId = searchParams.get('transaction')
    const transactionType = searchParams.get('transactionType') as import("@/types/transactions").TransactionType | null
    const workOrderId = searchParams.get('workOrder')

    const [selectedTransaction, setSelectedTransaction] = useState<{ id: number | string, type: import("@/types/transactions").TransactionType } | null>(null)
    const [activeWorkOrderId, setActiveWorkOrderId] = useState<number | null>(null)

    useEffect(() => {
        if (transactionId && transactionType && !selectedTransaction) {
            setSelectedTransaction({ id: transactionId, type: transactionType })
        }
        if (workOrderId && !activeWorkOrderId) {
            setActiveWorkOrderId(Number(workOrderId))
        }
    }, [transactionId, transactionType, workOrderId, selectedTransaction, activeWorkOrderId])

    const openTransaction = (id: number | string, type: string) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('transaction', String(id))
        params.set('transactionType', type)
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const closeTransaction = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('transaction')
        params.delete('transactionType')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        setSelectedTransaction(null)
    }

    const openWorkOrder = (id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('workOrder', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const closeWorkOrder = () => {
        const params = new URLSearchParams(searchParams.toString())
        params.delete('workOrder')
        router.replace(`${pathname}?${params.toString()}`, { scroll: false })
        setActiveWorkOrderId(null)
    }

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
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            size="full"
            hideScrollArea={true}
            allowOverflow={true}
            className="max-w-5xl"
            headerClassName="sr-only" // We are using a custom header inside for complex layout
            title={`Insights del Producto: ${productName}`}
        >
            <div className="flex flex-col h-full overflow-visible">
                {loading ? (
                    <div className="p-6">
                        <FormSkeleton hasTabs tabs={4} cards={1} fields={6} />
                    </div>
                ) : !data ? (
                    <div className="flex-1 flex items-center justify-center py-20">
                        <p className="text-muted-foreground">Error al cargar datos.</p>
                    </div>
                ) : (
                    <FormTabs
                        value={activeTab}
                        onValueChange={setActiveTab}
                        orientation="vertical"
                        header={
                            <div className="p-6 pb-2 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <h2 className="text-xl font-bold">Insights del Producto</h2>
                                        {productName && (
                                            <p className="text-sm text-muted-foreground font-medium">
                                                {productName}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        }
                        items={[
                            { value: "overview", label: "Resumen", icon: LayoutDashboard },
                            { value: "history", label: "Precios", icon: History },
                            { value: "kardex", label: "Kardex", icon: ArrowRightLeft },
                            { value: "production", label: "Producción", icon: Factory }
                        ]}
                        className="flex-1 overflow-visible"
                    >
                        <div className="flex-1 overflow-auto p-6 scrollbar-thin">

                            {/* OVERVIEW TAB */}
                            <FormTabsContent value="overview" className="mt-0 space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <Card className="bg-success/10 border-success/10">
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold text-success uppercase tracking-wider">Ventas Totales</p>
                                            <div className="flex items-baseline gap-2">
                                                <p className="text-2xl font-black text-success">{data.sales_analysis.total_sold}</p>
                                                <span className="text-xs text-success">uds</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-primary/10 border-primary/10">
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">Ingresos (Neto)</p>
                                            <DataCell.Currency value={data.sales_analysis.total_revenue} className="text-2xl font-black text-primary text-left" />
                                        </CardContent>
                                    </Card>
                                    <Card className="bg-warning/10 border-warning/10">
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold text-warning uppercase tracking-wider">Margen Bruto</p>
                                            <div className="flex items-baseline gap-2">
                                                <DataCell.Currency value={margin} className="text-2xl font-black text-warning text-left" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                    <Card className={marginPercent >= 20 ? "bg-primary/10 border-info/10" : "bg-destructive/10 border-destructive/20"}>
                                        <CardContent className="pt-4">
                                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">% de Margen</p>
                                            <div className="flex items-center gap-2">
                                                <p className={`text-2xl font-black ${marginPercent >= 20 ? 'text-info' : 'text-destructive'}`}>
                                                    {marginPercent.toFixed(1)}%
                                                </p>
                                                {marginPercent >= 20 ? <ArrowUpRight className="h-5 w-5 text-primary" /> : <ArrowDownRight className="h-5 w-5 text-destructive" />}
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
                                        <div className="rounded-md border p-4 space-y-3 bg-muted/50">
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
                                                <DataCell.Currency value={data.sales_analysis.avg_price - data.sales_analysis.avg_cost} className="font-black text-primary" />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <h4 className="text-sm font-bold flex items-center gap-2">
                                            <Factory className="h-4 w-4 text-primary" />
                                            Consumo en Producción
                                        </h4>
                                        <div className="rounded-md border p-4 bg-muted/50">
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
                            </FormTabsContent>

                            {/* HISTORY TAB */}
                            <FormTabsContent value="history" className="mt-0 space-y-6">
                                <div className="h-[250px] w-full bg-card rounded-md border p-4">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={[...data.price_history].reverse()}>
                                            <defs>
                                                <linearGradient id="colorSale" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                                                </linearGradient>
                                                <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="var(--destructive)" stopOpacity={0.1} />
                                                    <stop offset="95%" stopColor="var(--destructive)" stopOpacity={0} />
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
                                                formatter={(val) => [new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(Number(val || 0)), '']}
                                            />
                                            <Legend verticalAlign="top" height={36} />
                                            <Area type="monotone" name="Precio Venta" dataKey="sale_price" stroke="var(--primary)" fillOpacity={1} fill="url(#colorSale)" strokeWidth={2} />
                                            <Area type="monotone" name="Costo" dataKey="cost_price" stroke="var(--destructive)" fillOpacity={1} fill="url(#colorCost)" strokeWidth={2} />
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
                                                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[0.25rem] border border-border bg-muted/50 text-muted-foreground whitespace-nowrap">
                                                            {entry.user}
                                                        </span>
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
                            </FormTabsContent>

                            {/* KARDEX TAB */}
                            <FormTabsContent value="kardex" className="mt-0">
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>N°</TableHead>
                                                <TableHead>Tipo</TableHead>
                                                <TableHead>Cantidad</TableHead>
                                                <TableHead>P. Unitario</TableHead>
                                                <TableHead>Total</TableHead>
                                                <TableHead>Bodega</TableHead>
                                                <TableHead className="text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.kardex.map((move, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-xs">
                                                        {format(new Date(move.date), "dd/MM/yyyy")}
                                                    </TableCell>
                                                    <TableCell className="font-mono text-[10px] font-bold">
                                                        {move.display_id}
                                                    </TableCell>
                                                    <TableCell>
                                                        <StatusBadge
                                                            status={move.type === 'IN' ? 'SUCCESS' : move.type === 'OUT' ? 'DESTRUCTIVE' : 'WARNING'}
                                                            label={move.type === 'IN' ? 'Entrada' : move.type === 'OUT' ? 'Salida' : 'Ajuste'}
                                                        />
                                                    </TableCell>
                                                    <TableCell>
                                                        <DataCell.Number value={move.quantity} className="text-left" suffix={move.uom} decimals={2} />
                                                    </TableCell>
                                                    <TableCell>
                                                        <DataCell.Currency value={move.unit_price || 0} className="text-left" />
                                                    </TableCell>
                                                    <TableCell>
                                                        <DataCell.Currency value={move.total_price || 0} className="text-left" />
                                                    </TableCell>
                                                    <TableCell className="text-xs">{move.warehouse}</TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-primary"
                                                            onClick={() => {
                                                                if (move.related_type === 'work_order') {
                                                                    openWorkOrder(move.related_id)
                                                                } else {
                                                                    openTransaction(move.related_id, move.related_type)
                                                                }
                                                            }}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                            {data.kardex.length === 0 && (
                                                <TableRow>
                                                    <TableCell colSpan={8} className="text-center py-10 text-muted-foreground italic">
                                                        Sin movimientos registrados
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </FormTabsContent>

                            {/* PRODUCTION TAB */}
                            <FormTabsContent value="production" className="mt-0">
                                <div className="rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="bg-muted/50">
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>N° OT</TableHead>
                                                <TableHead>Cantidad Consumida</TableHead>
                                                <TableHead className="text-right">Acciones</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {data.production_usage.map((usage, i) => (
                                                <TableRow key={i}>
                                                    <TableCell className="text-xs">
                                                        {format(new Date(usage.date), "dd/MM/yyyy")}
                                                    </TableCell>
                                                    <TableCell>
                                                        <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-[0.25rem] border border-border bg-muted/50 text-muted-foreground whitespace-nowrap">
                                                            {formatEntityDisplay('production.workorder', { number: usage.ot_number })}
                                                        </span>
                                                    </TableCell>
                                                    <TableCell>
                                                        <DataCell.Number value={usage.quantity} className="text-left" decimals={2} />
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-primary"
                                                            onClick={() => openWorkOrder(usage.ot_id)}
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
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
                            </FormTabsContent>
                        </div>
                    </FormTabs>
                )}
            </div>

            {selectedTransaction && (
                <TransactionViewModal
                    open={!!selectedTransaction}
                    onOpenChange={(open) => !open && closeTransaction()}
                    type={selectedTransaction.type}
                    id={selectedTransaction.id}
                />
            )}

            {activeWorkOrderId && (
                <WorkOrderWizard
                    orderId={activeWorkOrderId}
                    open={!!activeWorkOrderId}
                    onOpenChange={(open) => !open && closeWorkOrder()}
                    onSuccess={() => fetchInsights()}
                />
            )}
        </BaseModal>
    )
}
