"use client"
import { Chip, SkeletonShell, StatusBadge, StatCard, ChartLegend, DataTable, DataTableView, AutoEntityCard } from '@/components/shared'
import { useState, useMemo } from "react"
import { AnalyticsChart } from "@/components/shared/AnalyticsPanel/AnalyticsChart"
import { getCssChartColors } from "@/components/shared/AnalyticsPanel/nivo-theme"
import type { LineChartConfig, BarChartConfig } from "@/components/shared/AnalyticsPanel/types"
import {
    TrendingUp,
    BarChart3,
    ArrowRightLeft,
    Factory,
    LayoutDashboard,
    ChevronLeft,
    ShoppingCart,
    Banknote,
    CircleDollarSign,
    Package,
} from "lucide-react"
import { useProductInsights, useProduct } from "../hooks/useProducts"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { DataCell } from '@/components/shared'
import { formatEntityDisplay } from "@/lib/entity-registry"
import { parseDateOnly, cn } from "@/lib/utils"
import { formatCurrency, formatQuantity } from "@/lib/money"
import { ProductSelector } from "@/components/selectors"
import { LazyDrawer, type TransactionType } from "@/features/_shared"
import { WorkOrderWizard } from "@/features/production"
import type { ColumnDef } from "@tanstack/react-table"
import { useStockMoves } from "@/features/inventory/hooks/useStockMoves"
import { stockMoveFields, type StockMove } from "@/features/inventory/stockMoveFields"
import { stockMoveActions, type StockMoveActionsCtx } from "@/features/inventory/stockMoveActions"
import { resolveStockMoveIcon } from "@/lib/movement-icons"
import { useEntityRouteActions } from "@/hooks/useEntityRouteActions"

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

interface SalesHistoryEntry {
    month: string
    revenue: number
    cost: number
    qty: number
}

interface ProductionHistoryEntry {
    month: string
    qty: number
}

interface SalesAnalysis {
    avg_price: number
    avg_cost: number
    total_sold: number
    total_revenue: number
    total_cost_basis: number
    history: SalesHistoryEntry[]
}

interface ProductInsights {
    price_history: PriceHistoryEntry[]
    kardex: KardexEntry[]
    sales_analysis: SalesAnalysis
    production_usage: ProductionUsage[]
    production_history: ProductionHistoryEntry[]
}

interface ProductInsightsPanelProps {
    productId: number | null
    productName: string | null
    onBack?: () => void
    onProductChange?: (productId: number, productName: string) => void
}

function toLineSeries(
    rawData: Array<Record<string, string | number>>,
    keys: string[]
): LineChartConfig["data"] {
    return keys.map(key => ({
        id: key,
        data: rawData.map(d => ({
            x: d.name as string,
            y: Number(d[key] ?? 0),
        })),
    }))
}

export function ProductInsightsPanel({ productId, productName, onBack, onProductChange }: ProductInsightsPanelProps) {
    const { insights: data, isLoading: insightsLoading, refetch: refetchInsights } = useProductInsights<ProductInsights>(productId)
    const { product, isLoading: productLoading } = useProduct(productId)
    const loading = insightsLoading || productLoading

    const [activeTab, setActiveTab] = useState("overview")
    const [selectedTransaction, setSelectedTransaction] = useState<{ id: number | string, type: TransactionType } | null>(null)
    const [activeWorkOrderId, setActiveWorkOrderId] = useState<number | null>(null)

    const openTransaction = (id: number | string, type: string) => setSelectedTransaction({ id, type: type as TransactionType })
    const closeTransaction = () => setSelectedTransaction(null)
    const openWorkOrder = (id: number) => setActiveWorkOrderId(id)
    const closeWorkOrder = () => setActiveWorkOrderId(null)

    const margin = data ? data.sales_analysis.total_revenue - data.sales_analysis.total_cost_basis : 0
    const marginPercent = data && data.sales_analysis.total_revenue > 0
        ? (margin / data.sales_analysis.total_revenue) * 100
        : 0

    const salesLineData = useMemo((): LineChartConfig["data"] => {
        if (!data?.sales_analysis?.history?.length) return []
        const raw = data.sales_analysis.history.map(e => ({
            name: e.month, 'Ingresos': e.revenue, 'Costos': e.cost,
        }))
        return toLineSeries(raw, ['Ingresos', 'Costos'])
    }, [data])

    const demandBarData = useMemo((): BarChartConfig["data"] => {
        if (!data?.sales_analysis?.history?.length) return []
        return data.sales_analysis.history.map(e => ({ name: e.month, 'Demanda': e.qty }))
    }, [data])

    const priceLineData = useMemo((): LineChartConfig["data"] => {
        if (!data?.price_history?.length) return []
        const raw = [...data.price_history].reverse().map(e => ({
            name: format(new Date(e.date), "dd/MMM", { locale: es }),
            'Precio Venta': e.sale_price,
        }))
        return toLineSeries(raw, ['Precio Venta'])
    }, [data])

    const costLineData = useMemo((): LineChartConfig["data"] => {
        if (!data?.price_history?.length) return []
        const raw = [...data.price_history].reverse().map(e => ({
            name: format(new Date(e.date), "dd/MMM", { locale: es }),
            'Costo': e.cost_price,
        }))
        return toLineSeries(raw, ['Costo'])
    }, [data])

    const productionBarData = useMemo((): BarChartConfig["data"] => {
        if (!data?.production_history?.length) return []
        return data.production_history.map(e => ({ name: e.month, 'Consumo OT': e.qty }))
    }, [data])

    const kardexFlowData = useMemo((): LineChartConfig["data"] => {
        if (!data?.kardex?.length) return []
        const flowMap = new Map<string, { in: number, out: number }>()
        data.kardex.forEach(entry => {
            const dateStr = format(parseDateOnly(entry.date), "dd/MM/yy")
            const curr = flowMap.get(dateStr) ?? { in: 0, out: 0 }
            if (entry.type === 'IN') curr.in += entry.quantity
            else if (entry.type === 'OUT') curr.out += entry.quantity
            flowMap.set(dateStr, curr)
        })
        const arr = Array.from(flowMap.entries())
            .map(([name, v]) => ({ name, 'Entradas': v.in, 'Salidas': v.out }))
            .reverse().slice(-30)
        return toLineSeries(arr, ['Entradas', 'Salidas'])
    }, [data])

    const currentValuation = product
        ? product.current_stock * Number(product.cost_price || 0)
        : 0

    const palette = getCssChartColors()

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full">
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {loading || !data || !product ? (
                    <SkeletonShell isLoading={loading} ariaLabel="Cargando insights del producto">
                        <div className="p-6" />
                    </SkeletonShell>
                ) : (
                    <div className="flex-1 flex flex-row gap-4 w-full h-full min-h-0 overflow-hidden bg-transparent">
                        <div className="w-52 shrink-0 flex flex-col gap-2 overflow-y-auto bg-transparent pb-4">
                            {onBack && (
                                <div className="flex flex-col gap-2 mb-2 pb-4 border-b border-border/60">
                                    <button
                                        onClick={onBack}
                                        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                                    >
                                        <ChevronLeft className="h-3 w-3 group-hover:-translate-x-0.5 transition-transform" />
                                        Volver a Existencias
                                    </button>
                                    {productName && !onProductChange && (
                                        <div className="flex items-start gap-2 mt-1">
                                            <BarChart3 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                            <span className="text-sm font-semibold leading-tight break-words">{productName}</span>
                                        </div>
                                    )}
                                    {onProductChange && (
                                        <div className="mt-1 w-full">
                                            <ProductSelector
                                                value={productId ?? undefined}
                                                onChange={() => {}}
                                                onSelect={(p) => onProductChange(p.id as number, p.name)}
                                                placeholder="Buscar producto..."
                                                variant="inline"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                            {([
                                { value: "overview",   label: "Resumen",    icon: LayoutDashboard },
                                { value: "sales",      label: "Ventas",     icon: TrendingUp },
                                { value: "price",      label: "Precio",     icon: CircleDollarSign },
                                { value: "cost",       label: "Costos",     icon: Banknote },
                                { value: "kardex",     label: "Mov. Stock", icon: ArrowRightLeft },
                                { value: "production", label: "Producción", icon: Factory },
                            ] as const).map((t) => {
                                const Icon = t.icon
                                const isActive = t.value === activeTab
                                return (
                                    <button
                                        key={t.value}
                                        onClick={() => setActiveTab(t.value)}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-sm text-sm font-medium transition-all duration-200",
                                            isActive
                                                ? "bg-primary text-primary-foreground shadow-md"
                                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                        )}
                                    >
                                        <Icon className={cn("h-4 w-4", isActive ? "opacity-100" : "opacity-70")} />
                                        {t.label}
                                    </button>
                                )
                            })}
                        </div>

                        <div className="flex-1 flex flex-col gap-6 overflow-y-auto px-1 pb-4 min-h-0">

                            {/* OVERVIEW */}
                            <div className={cn("flex flex-col gap-6 flex-1 min-h-0", activeTab !== "overview" && "hidden")}>
                                <div className="grid grid-cols-3 gap-4 shrink-0">
                                    <StatCard label="Ventas Totales"  valueSize="xl" value={`${formatQuantity(data.sales_analysis.total_sold)} ${product.uom_name}`} icon={ShoppingCart} accent="info" />
                                    <StatCard label="Valoración Actual" valueSize="xl" value={formatCurrency(currentValuation)} icon={Banknote} accent="success" />
                                    <StatCard label="Stock Actual"    valueSize="xl" value={`${formatQuantity(product.current_stock)} ${product.uom_name}`} icon={Package} accent="primary" />
                                </div>
                                <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                                    <StatCard
                                        label="Evolución Ingresos vs Costos"
                                        variant="chart"
                                        className="flex-1 min-h-0"
                                        chart={salesLineData.length ? <AnalyticsChart type="line-chart" preset="card" data={salesLineData} showLegend valueFormat="currency" /> : <EmptyChart />}
                                        chartLegend={salesLineData.length ? <ChartLegend items={['Ingresos','Costos'].map((id,i) => ({label:id, color:palette[i%palette.length]}))} /> : undefined}
                                    />
                                    <StatCard
                                        label="Consumo Mensual en OT"
                                        variant="chart"
                                        className="flex-1 min-h-0"
                                        chart={productionBarData.length ? <AnalyticsChart type="bar-chart" preset="card" data={productionBarData} keys={['Consumo OT']} indexBy="name" /> : <EmptyChart />}
                                    />
                                </div>
                            </div>

                            {/* SALES */}
                            <div className={cn("flex flex-col gap-6 flex-1 min-h-0", activeTab !== "sales" && "hidden")}>
                                <div className="grid grid-cols-3 gap-4 shrink-0">
                                    <StatCard label="Total Ingresos"        valueSize="xl" value={formatCurrency(data.sales_analysis.total_revenue)}    icon={Banknote}         accent="success" />
                                    <StatCard label="Total Costos de Venta" valueSize="xl" value={formatCurrency(data.sales_analysis.total_cost_basis)} icon={CircleDollarSign} accent="warning" />
                                    <StatCard label="Margen Bruto"          valueSize="xl" value={`${marginPercent.toFixed(1)}%`} subtext={formatCurrency(margin)} icon={TrendingUp} accent={margin >= 0 ? "success" : "destructive"} />
                                </div>
                                <StatCard
                                    label="Evolución de la Demanda"
                                    variant="chart"
                                    className="flex-1 min-h-0"
                                    chart={demandBarData.length ? <AnalyticsChart type="bar-chart" preset="card" data={demandBarData} keys={['Demanda']} indexBy="name" /> : <EmptyChart />}
                                />
                            </div>

                            {/* PRICE */}
                            <div className={cn("flex flex-col gap-6 flex-1 min-h-0", activeTab !== "price" && "hidden")}>
                                <div className="grid grid-cols-3 gap-4 shrink-0">
                                    <StatCard label="Precio Actual (c/IVA)" valueSize="xl" value={formatCurrency(Number(product.sale_price_gross || product.sale_price))} icon={CircleDollarSign} accent="primary" />
                                    <StatCard label="Precio Mínimo Hist."   valueSize="xl" value={formatCurrency(data.price_history.length ? Math.min(...data.price_history.filter(h => h.sale_price > 0).map(h => h.sale_price)) : 0)} icon={TrendingUp} accent="info" />
                                    <StatCard label="Precio Máximo Hist."   valueSize="xl" value={formatCurrency(data.price_history.length ? Math.max(...data.price_history.filter(h => h.sale_price > 0).map(h => h.sale_price)) : 0)} icon={TrendingUp} accent="accent" />
                                </div>
                                <StatCard
                                    label="Evolución del Precio de Venta"
                                    variant="chart"
                                    className="flex-1 min-h-[300px]"
                                    chart={priceLineData.length ? <AnalyticsChart type="line-chart" preset="card" data={priceLineData} valueFormat="currency" /> : <EmptyChart />}
                                />
                                <div className="rounded-md border flex-1 min-h-[250px] overflow-hidden flex flex-col"><PriceHistoryTable entries={data.price_history} /></div>
                            </div>

                            {/* COST */}
                            <div className={cn("flex flex-col gap-6 flex-1 min-h-0", activeTab !== "cost" && "hidden")}>
                                <div className="grid grid-cols-3 gap-4 shrink-0">
                                    <StatCard label="Costo Actual"        valueSize="xl" value={formatCurrency(Number(product.cost_price || 0))} icon={Banknote}    accent="warning" />
                                    <StatCard label="Costo Mínimo Hist."  valueSize="xl" value={formatCurrency(data.price_history.length ? Math.min(...data.price_history.filter(h => h.cost_price > 0).map(h => h.cost_price)) : 0)} icon={TrendingUp} accent="info" />
                                    <StatCard label="Costo Máximo Hist."  valueSize="xl" value={formatCurrency(data.price_history.length ? Math.max(...data.price_history.filter(h => h.cost_price > 0).map(h => h.cost_price)) : 0)} icon={TrendingUp} accent="destructive" />
                                </div>
                                <StatCard
                                    label="Evolución del Costo Ponderado"
                                    variant="chart"
                                    className="flex-1 min-h-[300px]"
                                    chart={costLineData.length ? <AnalyticsChart type="line-chart" preset="card" data={costLineData} valueFormat="currency" /> : <EmptyChart />}
                                />
                                <div className="rounded-md border flex-1 min-h-[250px] overflow-hidden flex flex-col"><CostHistoryTable entries={data.price_history} /></div>
                            </div>

                            {/* KARDEX */}
                            <div className={cn("flex flex-col gap-6 flex-1 min-h-0", activeTab !== "kardex" && "hidden")}>
                                <StatCard
                                    label="Flujo de Movimientos Recientes"
                                    variant="chart"
                                    className="flex-1 min-h-[300px]"
                                    chart={kardexFlowData.length ? <AnalyticsChart type="line-chart" preset="card" data={kardexFlowData} enableArea showLegend /> : <EmptyChart />}
                                    chartLegend={kardexFlowData.length ? <ChartLegend items={['Entradas','Salidas'].map((id,i) => ({label:id, color:palette[i%palette.length]}))} /> : undefined}
                                />
                                <div className="rounded-md border flex-1 min-h-[300px] overflow-hidden flex flex-col">
                                    {productId && <ProductStockMovesTable productId={productId} />}
                                </div>
                            </div>

                            {/* PRODUCTION */}
                            <div className={cn("flex flex-col gap-6 flex-1 min-h-0", activeTab !== "production" && "hidden")}>
                                <StatCard
                                    label="Consumo Mensual en OT"
                                    variant="chart"
                                    className="flex-1 min-h-[300px]"
                                    chart={productionBarData.length ? <AnalyticsChart type="bar-chart" preset="card" data={productionBarData} keys={['Consumo OT']} indexBy="name" /> : <EmptyChart />}
                                />
                                <div className="rounded-md border flex-1 min-h-[300px] overflow-hidden flex flex-col">
                                    <ProductionUsageTable entries={data.production_usage} onOpenWorkOrder={openWorkOrder} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {selectedTransaction && (
                <LazyDrawer
                    type={selectedTransaction.type}
                    id={Number(selectedTransaction.id)}
                    open={!!selectedTransaction}
                    onOpenChange={(open) => !open && closeTransaction()}
                />
            )}

            {activeWorkOrderId && (
                <WorkOrderWizard
                    mode={{ kind: 'manage', orderId: activeWorkOrderId }}
                    open={!!activeWorkOrderId}
                    onOpenChange={(open) => !open && closeWorkOrder()}
                    onSuccess={() => refetchInsights()}
                />
            )}
        </div>
    )
}

function EmptyChart() {
    return (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground italic">
            Sin datos suficientes para el gráfico
        </div>
    )
}

function PriceHistoryTable({ entries }: { entries: PriceHistoryEntry[] }) {
    const columns: ColumnDef<PriceHistoryEntry>[] = [
        { header: "Fecha",           cell: ({ row }) => <span className="text-xs">{format(new Date(row.original.date), "dd/MM/yyyy HH:mm", { locale: es })}</span> },
        { header: "Usuario",         cell: ({ row }) => <Chip size="xs" className="whitespace-nowrap">{row.original.user}</Chip> },
        { header: "Precio de Venta", cell: ({ row }) => <DataCell.Currency value={row.original.sale_price} className="text-left font-bold" /> },
    ]
    return <DataTable columns={columns} data={entries} variant="embedded" hidePagination emptyState={{ context: "search", title: "Sin historial de precios", description: "No hay cambios de precio registrados." }} />
}

function CostHistoryTable({ entries }: { entries: PriceHistoryEntry[] }) {
    const columns: ColumnDef<PriceHistoryEntry>[] = [
        { header: "Fecha",            cell: ({ row }) => <span className="text-xs">{format(new Date(row.original.date), "dd/MM/yyyy HH:mm", { locale: es })}</span> },
        { header: "Usuario",          cell: ({ row }) => <Chip size="xs" className="whitespace-nowrap">{row.original.user}</Chip> },
        { header: "Costo Ponderado",  cell: ({ row }) => <DataCell.Currency value={row.original.cost_price} className="text-left" /> },
    ]
    return <DataTable columns={columns} data={entries} variant="embedded" hidePagination emptyState={{ context: "search", title: "Sin historial de costos", description: "No hay cambios de costo registrados." }} />
}

function ProductStockMovesTable({ productId }: { productId: number }) {
    const [pageState, setPageState] = useState({ pageIndex: 0, pageSize: 20 })
    const { page, totalCount, isLoading } = useStockMoves({
        product: productId,
        page: pageState.pageIndex + 1,
        page_size: pageState.pageSize,
    })
    
    const { openView } = useEntityRouteActions()
    
    const actionsCtx: StockMoveActionsCtx = {
        onViewDetails: (id) => openView(id),
    }

    const columns = useMemo<ColumnDef<StockMove>[]>(() => [
        ...stockMoveFields.toColumns(),
        stockMoveActions.auto(actionsCtx),
    ], [actionsCtx])

    return (
        <DataTableView
            entityLabel="inventory.stockmove"
            forceView="list"
            data={(page?.results || []) as StockMove[]}
            columns={columns}
            manualPagination={true}
            pageCount={page ? Math.ceil(page.count / page.pageSize) : 0}
            rowCount={totalCount}
            pagination={pageState}
            onPaginationChange={setPageState}
            isLoading={isLoading}
            variant="embedded"
            renderCard={(move: StockMove) => {
                const { icon, iconClassName } = resolveStockMoveIcon(move)
                return (
                    <AutoEntityCard
                        key={move.id}
                        data={move}
                        fields={stockMoveFields}
                        entityLabel="inventory.stockmove"
                        icon={icon}
                        iconClassName={iconClassName}
                        actions={stockMoveActions.render(move, actionsCtx)}
                        defaultAction={stockMoveActions.defaultAction(actionsCtx)?.(move) ?? (() => openView(move.id))}
                    />
                )
            }}
        />
    )
}

function ProductionUsageTable({ entries, onOpenWorkOrder }: { entries: ProductionUsage[], onOpenWorkOrder: (id: number) => void }) {
    const columns: ColumnDef<ProductionUsage>[] = [
        { header: "Fecha",             cell: ({ row }) => <span className="text-xs">{format(parseDateOnly(row.original.date), "dd/MM/yyyy")}</span> },
        { header: "N° OT",            cell: ({ row }) => <Chip size="xs" className="whitespace-nowrap">{formatEntityDisplay('production.workorder', { number: row.original.ot_number })}</Chip> },
        { header: "Cantidad Consumida",cell: ({ row }) => <DataCell.Number value={row.original.quantity} className="text-left" /> },
        { header: "Acciones",          cell: ({ row }) => <div className="text-right"><DataCell.ActionGroup><DataCell.Action action="detail" onClick={() => onOpenWorkOrder(row.original.ot_id)} /></DataCell.ActionGroup></div> },
    ]
    return <DataTable columns={columns} data={entries} variant="embedded" hidePagination emptyState={{ context: "search", title: "Sin uso en producción", description: "Este producto no ha sido utilizado como material en producción." }} />
}
