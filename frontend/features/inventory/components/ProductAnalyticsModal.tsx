"use client"

import { useState, useMemo, type ReactNode } from "react"
import {
    Chip, SkeletonShell, StatCard, ChartLegend, AnalyticsChart, getCssChartColors,
    BaseModal, DataCell, DrawerLayout, RailNav,
} from '@/components/shared'
import type { LineChartConfig, BarChartConfig } from '@/components/shared'
import {
    TrendingUp,
    BarChart3,
    ArrowRightLeft,
    Factory,
    LayoutDashboard,
    ShoppingCart,
    Banknote,
    CircleDollarSign,
    Package,
    Truck,
    Users,
    Building2,
    Percent,
    Hammer,
    Scale,
} from "lucide-react"
import { useProductInsights, useProduct } from "../hooks/useProducts"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { formatEntityDisplay, getDomainConceptTitle } from "@/lib/entity-registry"
import { parseDateOnly, cn } from "@/lib/utils"
import { formatCurrency, formatQuantity } from "@/lib/money"
import { ProductSelector } from "@/components/selectors"
import { LazyDrawer, type TransactionType } from "@/features/_shared"
import { WorkOrderWizard } from "@/features/production"
import { Collection, useEntityCollection } from "@/components/entity-view"
import { useStockMoves } from "@/features/inventory/hooks/useStockMoves"
import { stockMoveActions, type StockMoveActionsCtx } from "@/features/inventory/stockMoveActions"
import {
    priceHistoryEntity, priceHistoryViews, costHistoryEntity, costHistoryViews,
    type PriceHistoryEntry,
} from "../entity-view/priceHistory.entity"
import { productionUsageEntity, productionUsageViews } from "../entity-view/productionUsage.entity"
import { topCustomerEntity, topCustomerViews } from "../entity-view/topCustomer.entity"
import { topSupplierEntity, topSupplierViews } from "../entity-view/topSupplier.entity"
import { SalesImpactBlock } from "../analytics/SalesImpactBlock"
import { ProductionPerformanceBlock } from "../analytics/ProductionPerformanceBlock"
import { SourcingBlock } from "../analytics/SourcingBlock"
import {
    SEGMENT_LABELS, overviewKpiIds, visibleTabIds,
    type OverviewKpiId, type ProductCapabilities,
} from "../analytics/productAnalyticsRegistry"
import { stockMoveEntity, stockMoveViews, type StockMove } from "../entity-view/stockMove.entity"

// ─── Types ───────────────────────────────────────────────────────────────────

interface StockFlow {
    totals: { in_qty: number; in_cost: number; out_qty: number; out_cost: number }
    monthly: Array<{ month: string; in: number; out: number }>
}

interface ProductionUsage {
    date: string
    ot_id: number
    ot_number: string
    quantity: number
    description: string
}

interface SalesHistoryEntry { month: string; revenue: number; cost: number; qty: number }
interface PurchaseHistoryEntry { month: string; cost: number; qty: number }
interface ProductionHistoryEntry { month: string; qty: number }
interface StockHistoryEntry { date: string; stock: number }
interface TopCustomer { name: string; total_revenue: number; total_cost: number; total_qty: number }
interface TopSupplier { name: string; total_cost: number; total_qty: number }

interface SalesAnalysis {
    avg_price: number; avg_cost: number
    total_sold: number; total_revenue: number; total_cost_basis: number
    history: SalesHistoryEntry[]
}
interface PurchaseAnalysis {
    total_purchased: number; total_cost: number
    history: PurchaseHistoryEntry[]
}

interface ProductInsights {
    capabilities?: ProductCapabilities
    price_history: PriceHistoryEntry[]
    stock_flow: StockFlow
    stock_history: StockHistoryEntry[]
    sales_analysis: SalesAnalysis
    purchase_analysis: PurchaseAnalysis
    production_usage: ProductionUsage[]
    production_history: ProductionHistoryEntry[]
    top_customers: TopCustomer[]
    top_suppliers: TopSupplier[]
}

interface ProductAnalyticsModalProps {
    productId: number | null
    productName?: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onProductChange?: (productId: number, productName: string) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function toLineSeries(
    rawData: Array<Record<string, string | number>>,
    keys: string[]
): LineChartConfig["data"] {
    return keys.map(key => ({
        id: key,
        data: rawData.map(d => ({ x: d.name as string, y: Number(d[key] ?? 0) })),
    }))
}

function EmptyChart() {
    return (
        <div className="flex items-center justify-center h-full text-sm text-muted-foreground italic">
            Sin datos suficientes para el gráfico
        </div>
    )
}

function SplitTabLayout({
    kpis,
    chart,
    table,
}: {
    kpis: React.ReactNode
    chart: React.ReactNode
    table: React.ReactNode
}) {
    return (
        <div className="flex flex-col gap-4 flex-1 min-h-0">
            <div className="shrink-0">{kpis}</div>
            <div className="flex flex-row gap-4 flex-1 min-h-0">
                <div className="flex-1 min-h-0">{chart}</div>
                <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{table}</div>
            </div>
        </div>
    )
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

const TABS = [
    { value: "overview",    label: "Resumen",    icon: LayoutDashboard },
    { value: "sales",       label: "Ventas",     icon: TrendingUp },
    { value: "pricing",     label: "Precio y margen", icon: Percent },
    { value: "purchases",   label: "Compras",    icon: Truck },
    { value: "price",       label: "Precio",     icon: CircleDollarSign },
    { value: "cost",        label: "Costos",     icon: Banknote },
    { value: "kardex",      label: "Mov. Stock", icon: ArrowRightLeft },
    { value: "production",  label: "Producción", icon: Factory },
    { value: "manufacturing", label: "Fabricación", icon: Hammer },
    { value: "sourcing", label: "Abastecimiento", icon: Scale },
    { value: "customers",   label: "Clientes",   icon: Users },
    { value: "suppliers",   label: "Proveedores", icon: Building2 },
] as const

type TabValue = typeof TABS[number]["value"]

const KPI_GRID: Record<number, string> = {
    1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-2 lg:grid-cols-3", 4: "grid-cols-2 lg:grid-cols-4",
}

// ─── Inner panel (runs inside the open modal) ──────────────────────────────────

function ProductAnalyticsPanelInner({
    productId,
    productName,
    onProductChange,
    onClose,
}: {
    productId: number
    productName?: string | null
    onProductChange?: (productId: number, productName: string) => void
    onClose: () => void
}) {
    const { insights: data, isLoading: insightsLoading } = useProductInsights<ProductInsights>(productId)
    const { product, isLoading: productLoading } = useProduct(productId)
    const loading = insightsLoading || productLoading

    const [requestedTab, setActiveTab] = useState<TabValue>("overview")
    const [selectedTransaction, setSelectedTransaction] = useState<{ id: number | string, type: TransactionType } | null>(null)
    const [activeWorkOrderId, setActiveWorkOrderId] = useState<number | null>(null)

    const capabilities = data?.capabilities
    const visibleTabs = useMemo(() => {
        const ids = new Set<string>(visibleTabIds(capabilities))
        return TABS.filter(t => ids.has(t.value))
    }, [capabilities])
    // A tab that stops applying (e.g. after switching product) falls back to the overview.
    const activeTab: TabValue = visibleTabs.some(t => t.value === requestedTab) ? requestedTab : "overview"

    const openTransaction = (id: number | string, type: string) => setSelectedTransaction({ id, type: type as TransactionType })
    const closeTransaction = () => setSelectedTransaction(null)
    const openWorkOrder = (id: number) => setActiveWorkOrderId(id)
    const closeWorkOrder = () => setActiveWorkOrderId(null)

    // ── Sub-table collections ────────────────────────────────────────────────

    const priceGross0 = product ? Number(product.sale_price_gross || product.sale_price || 0) : 0
    const priceNet0   = product ? Number(product.sale_price || 0) : 0
    const ivaRatio    = priceNet0 > 0 ? priceGross0 / priceNet0 : 1

    const transformedPriceHistory = useMemo<PriceHistoryEntry[]>(() =>
        (data?.price_history ?? []).map(e => ({ ...e, sale_price_gross: e.sale_price * ivaRatio })),
    [data, ivaRatio])

    const priceHistoryCollection = useEntityCollection(
        priceHistoryEntity,
        { rows: transformedPriceHistory },
        { pagination: { mode: "none" } },
    )

    const costHistoryCollection = useEntityCollection(
        costHistoryEntity,
        { rows: data?.price_history ?? [] },
        { pagination: { mode: "none" } },
    )

    const productionUsageCollection = useEntityCollection(
        productionUsageEntity,
        { rows: data?.production_usage ?? [] },
        { pagination: { mode: "none" } },
    )

    const topCustomerCollection = useEntityCollection(
        topCustomerEntity,
        { rows: (data?.top_customers ?? []) as TopCustomer[] },
        { pagination: { mode: "none" } },
    )

    const topSupplierCollection = useEntityCollection(
        topSupplierEntity,
        { rows: (data?.top_suppliers ?? []) as TopSupplier[] },
        { pagination: { mode: "none" } },
    )

    const [stockMovesPagination, setStockMovesPagination] = useState({ pageIndex: 0, pageSize: 20 })
    const { page: stockMovesPage, isLoading: stockMovesLoading } = useStockMoves({
        product_id: productId,
        page: stockMovesPagination.pageIndex + 1,
        page_size: stockMovesPagination.pageSize,
    })

    const stockMovesActionsCtx: StockMoveActionsCtx = {
        onViewDetails: (id) => openTransaction(id, 'stock_move'),
    }

    const stockMovesCollection = useEntityCollection(
        stockMoveEntity,
        {
            rows: stockMovesLoading ? [] : (stockMovesPage?.results ?? []) as StockMove[],
            rowCount: stockMovesPage?.count,
        },
        {
            pagination: {
                mode: "server",
                state: stockMovesPagination,
                onChange: setStockMovesPagination,
            },
        },
    )

    // ── Derived chart data ───────────────────────────────────────────────────

    const salesUnitData = useMemo((): LineChartConfig["data"] => {
        if (!data?.sales_analysis?.history?.length) return []
        const raw = data.sales_analysis.history.map(e => ({
            name: e.month,
            'Ingreso Unitario': e.qty > 0 ? e.revenue / e.qty : 0,
            'Costo Unitario':   e.qty > 0 ? e.cost   / e.qty : 0,
        }))
        return toLineSeries(raw, ['Ingreso Unitario', 'Costo Unitario'])
    }, [data])

    const salesQtyData = useMemo((): BarChartConfig["data"] => {
        if (!data?.sales_analysis?.history?.length) return []
        return data.sales_analysis.history.map(e => ({ name: e.month, 'Unidades': e.qty }))
    }, [data])

    const purchaseCostData = useMemo((): LineChartConfig["data"] => {
        if (!data?.purchase_analysis?.history?.length) return []
        const raw = data.purchase_analysis.history.map(e => ({ name: e.month, 'Costo Compra': e.cost }))
        return toLineSeries(raw, ['Costo Compra'])
    }, [data])

    const purchaseQtyData = useMemo((): BarChartConfig["data"] => {
        if (!data?.purchase_analysis?.history?.length) return []
        return data.purchase_analysis.history.map(e => ({ name: e.month, 'Unidades': e.qty }))
    }, [data])

    const priceLineData = useMemo((): LineChartConfig["data"] => {
        if (!data?.price_history?.length) return []
        const raw = [...data.price_history].reverse().map(e => ({
            name: format(parseDateOnly(e.date.slice(0, 10)), "dd/MMM", { locale: es }),
            'Precio Venta c/IVA': e.sale_price * ivaRatio,
        }))
        return toLineSeries(raw, ['Precio Venta c/IVA'])
    }, [data, ivaRatio])

    const costLineData = useMemo((): LineChartConfig["data"] => {
        if (!data?.price_history?.length) return []
        const raw = [...data.price_history].reverse().map(e => ({
            name: format(parseDateOnly(e.date.slice(0, 10)), "dd/MMM", { locale: es }),
            'Costo': e.cost_price,
        }))
        return toLineSeries(raw, ['Costo'])
    }, [data])

    const productionBarData = useMemo((): BarChartConfig["data"] => {
        if (!data?.production_history?.length) return []
        return data.production_history.map(e => ({ name: e.month, 'Consumo OT': e.qty }))
    }, [data])

    const kardexFlowData = useMemo((): LineChartConfig["data"] => {
        const monthly = data?.stock_flow?.monthly
        if (!monthly?.length) return []
        return toLineSeries(
            monthly.slice(-12).map(m => ({ name: m.month, 'Entradas': m.in, 'Salidas': m.out })),
            ['Entradas', 'Salidas'],
        )
    }, [data])

    const stockHistoryData = useMemo((): LineChartConfig["data"] => {
        if (!data?.stock_history?.length) return []
        const raw = data.stock_history.map(e => ({ name: e.date, 'Stock': e.stock }))
        return toLineSeries(raw, ['Stock'])
    }, [data])

    const customerBarData = useMemo((): BarChartConfig["data"] => {
        if (!data?.top_customers?.length) return []
        return data.top_customers.slice(0, 8).map(c => ({ name: c.name, 'Ingresos': c.total_revenue }))
    }, [data])

    const supplierBarData = useMemo((): BarChartConfig["data"] => {
        if (!data?.top_suppliers?.length) return []
        return data.top_suppliers.slice(0, 8).map(s => ({ name: s.name, 'Costo': s.total_cost }))
    }, [data])

    const currentValuation = product ? Number(product.current_stock ?? 0) * Number(product.cost_price || 0) : 0
    const margin = data ? data.sales_analysis.total_revenue - data.sales_analysis.total_cost_basis : 0
    const marginPercent = data && data.sales_analysis.total_revenue > 0 ? (margin / data.sales_analysis.total_revenue) * 100 : 0
    const palette = getCssChartColors()

    const priceGross = priceGross0
    const priceNet   = priceNet0
    const priceMinGross = data?.price_history?.length ? Math.min(...data.price_history.filter(h => h.sale_price > 0).map(h => h.sale_price)) * ivaRatio : 0
    const priceMaxGross = data?.price_history?.length ? Math.max(...data.price_history.filter(h => h.sale_price > 0).map(h => h.sale_price)) * ivaRatio : 0
    const costCurrent = product ? Number(product.cost_price || 0) : 0
    const costMin = data?.price_history?.length ? Math.min(...data.price_history.filter(h => h.cost_price > 0).map(h => h.cost_price)) : 0
    const costMax = data?.price_history?.length ? Math.max(...data.price_history.filter(h => h.cost_price > 0).map(h => h.cost_price)) : 0

    const flowTotals = data?.stock_flow?.totals
    const kardexStats = {
        inQty: flowTotals?.in_qty ?? 0, inCost: flowTotals?.in_cost ?? 0,
        outQty: flowTotals?.out_qty ?? 0, outCost: flowTotals?.out_cost ?? 0,
    }

    const segmentLabel = capabilities ? SEGMENT_LABELS[capabilities.segment] : null
    const productIdentity = onProductChange ? (
        <ProductSelector
            value={productId}
            onChange={() => {}}
            onSelect={(p) => onProductChange(p.id as number, p.name)}
            placeholder="Buscar producto..."
            variant="inline"
        />
    ) : productName ? (
        <span className="block text-sm font-semibold leading-tight break-words">{productName}</span>
    ) : null
    const productSelectorSlot = productIdentity || segmentLabel ? (
        <div className="flex flex-col gap-1.5">
            {productIdentity}
            {segmentLabel && <span className="text-xs text-muted-foreground">{segmentLabel}</span>}
        </div>
    ) : null

    const kpiIds = overviewKpiIds(capabilities)
    // production_usage is only the 20 most recent consumptions; the monthly history is the full aggregate.
    const productionUsageQty = (data?.production_history ?? []).reduce((sum, h) => sum + h.qty, 0)
    const overviewKpiCards: Record<OverviewKpiId, ReactNode> = data && product ? {
        units_sold: <StatCard key="units_sold" label="Ventas Totales" valueSize="xl" value={`${formatQuantity(data.sales_analysis.total_sold)} ${product.uom_name}`} icon={ShoppingCart} accent="info" />,
        units_purchased: <StatCard key="units_purchased" label="Unidades Compradas" valueSize="xl" value={`${formatQuantity(data.purchase_analysis.total_purchased)} ${product.uom_name}`} icon={Truck} accent="info" />,
        valuation: <StatCard key="valuation" label="Valoración Actual" valueSize="xl" value={formatCurrency(currentValuation)} icon={Banknote} accent="success" />,
        stock: <StatCard key="stock" label="Stock Actual" valueSize="xl" value={`${formatQuantity(Number(product.current_stock ?? 0))} ${product.uom_name}`} icon={Package} accent="primary" />,
        production_usage: <StatCard key="production_usage" label="Consumo en OT" valueSize="xl" value={`${formatQuantity(productionUsageQty)} ${product.uom_name}`} icon={Factory} accent="warning" />,
    } : { units_sold: null, units_purchased: null, valuation: null, stock: null, production_usage: null }

    return (
        <div className="flex flex-col flex-1 min-h-0 h-full">
            {selectedTransaction && (
                <LazyDrawer
                    type={selectedTransaction.type}
                    id={Number(selectedTransaction.id)}
                    open={!!selectedTransaction}
                    onOpenChange={(open) => { if (!open) closeTransaction() }}
                />
            )}
            {activeWorkOrderId !== null && (
                <WorkOrderWizard
                    mode={{ kind: 'manage', orderId: activeWorkOrderId }}
                    open={!!activeWorkOrderId}
                    onOpenChange={(open) => !open && closeWorkOrder()}
                />
            )}

            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {loading || !data || !product ? (
                    <SkeletonShell isLoading={loading} ariaLabel="Cargando insights del producto">
                        <div className="p-6" />
                    </SkeletonShell>
                ) : (
                    <DrawerLayout
                        leftRail={
                            <RailNav
                                ariaLabel="Secciones de análisis de producto"
                                sections={[{ items: [...visibleTabs] }]}
                                value={activeTab}
                                onValueChange={(v) => setActiveTab(v as TabValue)}
                                top={productSelectorSlot}
                            />
                        }
                        leftRailWidth="w-14 sm:w-56"
                        noPadding
                        contentClassName="p-4"
                    >
                        {/* Compact copy of the rail's top slot (hidden there below sm) */}
                        {productSelectorSlot && <div className="mb-3 shrink-0 sm:hidden">{productSelectorSlot}</div>}
                        {/* ── Tab content ── */}
                        <div className="flex-1 flex flex-col gap-6 overflow-y-auto px-1 pb-4 min-h-0">

                            {/* OVERVIEW */}
                            <div className={cn("flex flex-col gap-6 flex-1 min-h-0", activeTab !== "overview" && "hidden")}>
                                {kpiIds.length > 0 && (
                                    <div className={cn("grid gap-4 shrink-0", KPI_GRID[Math.min(kpiIds.length, 4)])}>
                                        {kpiIds.map(id => overviewKpiCards[id])}
                                    </div>
                                )}
                                {(!capabilities || capabilities.tracks_stock) && (
                                    <StatCard
                                        label="Evolución del Stock"
                                        variant="chart"
                                        className="flex-1 min-h-[350px]"
                                        chart={stockHistoryData.length ? <AnalyticsChart type="line-chart" preset="card" data={stockHistoryData} enableArea /> : <EmptyChart />}
                                    />
                                )}
                            </div>

                            {/* SALES */}
                            <div className={cn("flex flex-col gap-4 flex-1 min-h-0", activeTab !== "sales" && "hidden")}>
                                <SplitTabLayout
                                    kpis={
                                        <div className="grid grid-cols-3 gap-4">
                                            <StatCard label="Total Ingresos"   valueSize="xl" value={formatCurrency(data.sales_analysis.total_revenue)}    icon={Banknote}         accent="success" />
                                            <StatCard label="Total Costos"     valueSize="xl" value={formatCurrency(data.sales_analysis.total_cost_basis)} icon={CircleDollarSign} accent="warning" />
                                            <StatCard label="Margen Neto (u.)" valueSize="xl" value={`${marginPercent.toFixed(1)}%`} subtext={data.sales_analysis.total_sold ? formatCurrency(margin / data.sales_analysis.total_sold) : '$0'} icon={TrendingUp} accent={marginPercent >= 0 ? "success" : "destructive"} />
                                        </div>
                                    }
                                    chart={
                                        <div className="flex flex-col gap-4 h-full min-h-0">
                                            <StatCard label="Evolución Ingresos vs Costos" variant="chart" className="flex-1 min-h-[220px]"
                                                chart={salesUnitData.length ? <AnalyticsChart type="line-chart" preset="card" data={salesUnitData} showLegend valueFormat="currency" /> : <EmptyChart />}
                                                chartLegend={salesUnitData.length ? <ChartLegend items={['Ingreso Unitario','Costo Unitario'].map((id,i) => ({label:id, color:palette[i%palette.length]}))} /> : undefined}
                                            />
                                            <StatCard label="Demanda (unidades)" variant="chart" className="flex-1 min-h-[160px]"
                                                chart={salesQtyData.length ? <AnalyticsChart type="bar-chart" preset="card" data={salesQtyData} keys={['Unidades']} indexBy="name" /> : <EmptyChart />}
                                            />
                                        </div>
                                    }
                                    table={
                                        <Collection.Root collection={topCustomerCollection}>
                                            <Collection.View table={topCustomerViews.table} emptyTitle="Sin ventas registradas" emptyDescription="No hay clientes con compras de este producto." />
                                        </Collection.Root>
                                    }
                                />
                            </div>

                            {/* PRICING & MARGIN — mounted only while active so it fetches on demand */}
                            {activeTab === "pricing" && (
                                <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
                                    <SalesImpactBlock productId={productId} />
                                </div>
                            )}

                            {/* MANUFACTURING PERFORMANCE — mounted only while active so it fetches on demand */}
                            {activeTab === "manufacturing" && (
                                <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
                                    <ProductionPerformanceBlock productId={productId} />
                                </div>
                            )}

                            {/* SOURCING — mounted only while active so it fetches on demand */}
                            {activeTab === "sourcing" && (
                                <div className="flex flex-col gap-4 flex-1 min-h-0 overflow-y-auto">
                                    <SourcingBlock productId={productId} />
                                </div>
                            )}

                            {/* PURCHASES */}
                            <div className={cn("flex flex-col gap-4 flex-1 min-h-0", activeTab !== "purchases" && "hidden")}>
                                <SplitTabLayout
                                    kpis={
                                        <div className="grid grid-cols-3 gap-4">
                                            <StatCard label="Unidades Compradas"     valueSize="xl" value={`${formatQuantity(data.purchase_analysis.total_purchased)} ${product.uom_name}`} icon={Truck} accent="info" />
                                            <StatCard label="Costo Total Compras"    valueSize="xl" value={formatCurrency(data.purchase_analysis.total_cost)} icon={Banknote} accent="warning" />
                                            <StatCard label="Costo Ponderado Actual" valueSize="xl" value={formatCurrency(costCurrent)} icon={CircleDollarSign} accent="primary" />
                                        </div>
                                    }
                                    chart={
                                        <div className="flex flex-col gap-4 h-full min-h-0">
                                            <StatCard label="Evolución del Costo de Compra" variant="chart" className="flex-1 min-h-[220px]"
                                                chart={purchaseCostData.length ? <AnalyticsChart type="line-chart" preset="card" data={purchaseCostData} valueFormat="currency" /> : <EmptyChart />}
                                            />
                                            <StatCard label="Unidades Recepcionadas por Mes" variant="chart" className="flex-1 min-h-[160px]"
                                                chart={purchaseQtyData.length ? <AnalyticsChart type="bar-chart" preset="card" data={purchaseQtyData} keys={['Unidades']} indexBy="name" /> : <EmptyChart />}
                                            />
                                        </div>
                                    }
                                    table={
                                        <Collection.Root collection={topSupplierCollection}>
                                            <Collection.View table={topSupplierViews.table} emptyTitle="Sin compras registradas" emptyDescription="No hay proveedores con recepciones de este producto." />
                                        </Collection.Root>
                                    }
                                />
                            </div>

                            {/* PRICE */}
                            <div className={cn("flex flex-col gap-4 flex-1 min-h-0", activeTab !== "price" && "hidden")}>
                                <SplitTabLayout
                                    kpis={
                                        <div className="grid grid-cols-3 gap-4">
                                            <StatCard label="Precio Actual"       valueSize="xl" value={formatCurrency(priceGross)}    subtext={`Neto: ${formatCurrency(priceNet)}`}                        icon={CircleDollarSign} accent="primary" />
                                            <StatCard label="Precio Mínimo Hist." valueSize="xl" value={formatCurrency(priceMinGross)} subtext={`Neto: ${formatCurrency(priceMinGross / ivaRatio)}`} icon={TrendingUp}       accent="info" />
                                            <StatCard label="Precio Máximo Hist." valueSize="xl" value={formatCurrency(priceMaxGross)} subtext={`Neto: ${formatCurrency(priceMaxGross / ivaRatio)}`} icon={TrendingUp}       accent="accent" />
                                        </div>
                                    }
                                    chart={
                                        <StatCard label="Evolución del Precio de Venta" variant="chart" className="h-full min-h-[300px]"
                                            chart={priceLineData.length ? <AnalyticsChart type="line-chart" preset="card" data={priceLineData} valueFormat="currency" /> : <EmptyChart />}
                                        />
                                    }
                                    table={
                                        <Collection.Root collection={priceHistoryCollection}>
                                            <Collection.View table={priceHistoryViews.table} emptyTitle="Sin historial de precios" emptyDescription="No hay cambios de precio registrados." />
                                        </Collection.Root>
                                    }
                                />
                            </div>

                            {/* COST */}
                            <div className={cn("flex flex-col gap-4 flex-1 min-h-0", activeTab !== "cost" && "hidden")}>
                                <SplitTabLayout
                                    kpis={
                                        <div className="grid grid-cols-3 gap-4">
                                            <StatCard label="Costo Actual"       valueSize="xl" value={formatCurrency(costCurrent)} icon={Banknote}    accent="warning" />
                                            <StatCard label="Costo Mínimo Hist." valueSize="xl" value={formatCurrency(costMin)}     icon={TrendingUp}  accent="info" />
                                            <StatCard label="Costo Máximo Hist." valueSize="xl" value={formatCurrency(costMax)}     icon={TrendingUp}  accent="destructive" />
                                        </div>
                                    }
                                    chart={
                                        <StatCard label="Evolución del Costo Ponderado" variant="chart" className="h-full min-h-[300px]"
                                            chart={costLineData.length ? <AnalyticsChart type="line-chart" preset="card" data={costLineData} valueFormat="currency" /> : <EmptyChart />}
                                        />
                                    }
                                    table={
                                        <Collection.Root collection={costHistoryCollection}>
                                            <Collection.View table={costHistoryViews.table} emptyTitle="Sin historial de costos" emptyDescription="No hay cambios de costo registrados." />
                                        </Collection.Root>
                                    }
                                />
                            </div>

                            {/* KARDEX */}
                            <div className={cn("flex flex-col gap-4 flex-1 min-h-0", activeTab !== "kardex" && "hidden")}>
                                <SplitTabLayout
                                    kpis={
                                        <div className="grid grid-cols-2 gap-4">
                                            <StatCard label="Total Entradas" valueSize="xl" value={`${formatQuantity(kardexStats.inQty)} ${product.uom_name}`} subtext={`Valorado en ${formatCurrency(kardexStats.inCost)}`} icon={ArrowRightLeft} accent="success" />
                                            <StatCard label="Total Salidas"  valueSize="xl" value={`${formatQuantity(kardexStats.outQty)} ${product.uom_name}`} subtext={`Valorado en ${formatCurrency(kardexStats.outCost)}`} icon={ArrowRightLeft} accent="destructive" />
                                        </div>
                                    }
                                    chart={
                                        <StatCard label="Flujo de Movimientos Recientes" variant="chart" className="h-full min-h-[300px]"
                                            chart={kardexFlowData.length ? <AnalyticsChart type="line-chart" preset="card" data={kardexFlowData} enableArea showLegend /> : <EmptyChart />}
                                            chartLegend={kardexFlowData.length ? <ChartLegend items={['Entradas','Salidas'].map((id,i) => ({label:id, color:palette[i%palette.length]}))} /> : undefined}
                                        />
                                    }
                                    table={
                                        <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                                            <Collection.Root
                                                collection={stockMovesCollection}
                                                actions={stockMoveActions.forCollection(stockMovesActionsCtx)}
                                            >
                                                <Collection.View
                                                    table={stockMoveViews.table}
                                                    emptyTitle="Sin movimientos"
                                                    emptyDescription="Este producto no tiene movimientos registrados."
                                                />
                                            </Collection.Root>
                                        </div>
                                    }
                                />
                            </div>

                            {/* PRODUCTION */}
                            <div className={cn("flex flex-col gap-4 flex-1 min-h-0", activeTab !== "production" && "hidden")}>
                                <SplitTabLayout
                                    kpis={
                                        <div className="grid grid-cols-2 gap-4">
                                            <StatCard label="Total Consumido en OT" valueSize="xl"
                                                value={`${formatQuantity(data.production_usage.reduce((a, u) => a + u.quantity, 0))} ${product.uom_name}`}
                                                icon={Factory} accent="primary" />
                                            <StatCard label={`N° de ${getDomainConceptTitle('ot', true)}`} valueSize="xl"
                                                value={String(new Set(data.production_usage.map(u => u.ot_id)).size)}
                                                icon={BarChart3} accent="info" />
                                        </div>
                                    }
                                    chart={
                                        <StatCard label="Consumo Mensual en OT" variant="chart" className="h-full min-h-[300px]"
                                            chart={productionBarData.length ? <AnalyticsChart type="bar-chart" preset="card" data={productionBarData} keys={['Consumo OT']} indexBy="name" /> : <EmptyChart />}
                                        />
                                    }
                                    table={
                                        <Collection.Root
                                            collection={productionUsageCollection}
                                            actions={(item) => (
                                                <DataCell.ActionGroup>
                                                    <DataCell.Action action="detail" onClick={() => openWorkOrder(item.ot_id)} />
                                                </DataCell.ActionGroup>
                                            )}
                                        >
                                            <Collection.View
                                                table={productionUsageViews.table}
                                                emptyTitle="Sin uso en producción"
                                                emptyDescription="Este producto no ha sido utilizado como material en producción."
                                            />
                                        </Collection.Root>
                                    }
                                />
                            </div>

                            {/* CUSTOMERS */}
                            <div className={cn("flex flex-col gap-4 flex-1 min-h-0", activeTab !== "customers" && "hidden")}>
                                <SplitTabLayout
                                    kpis={
                                        <div className="grid grid-cols-2 gap-4">
                                            <StatCard label="Clientes Únicos"  valueSize="xl" value={String(data.top_customers.length)} icon={Users} accent="info" />
                                            <StatCard label="Ingresos Totales" valueSize="xl" value={formatCurrency(data.sales_analysis.total_revenue)} icon={Banknote} accent="success" />
                                        </div>
                                    }
                                    chart={
                                        <StatCard label="Top Clientes por Ingresos" variant="chart" className="h-full min-h-[300px]"
                                            chart={customerBarData.length ? <AnalyticsChart type="bar-chart" preset="card" data={customerBarData} keys={['Ingresos']} indexBy="name" valueFormat="$,.0f" /> : <EmptyChart />}
                                        />
                                    }
                                    table={
                                        <Collection.Root collection={topCustomerCollection}>
                                            <Collection.View table={topCustomerViews.table} emptyTitle="Sin ventas registradas" emptyDescription="No hay clientes con compras de este producto." />
                                        </Collection.Root>
                                    }
                                />
                            </div>

                            {/* SUPPLIERS */}
                            <div className={cn("flex flex-col gap-4 flex-1 min-h-0", activeTab !== "suppliers" && "hidden")}>
                                <SplitTabLayout
                                    kpis={
                                        <div className="grid grid-cols-2 gap-4">
                                            <StatCard label="Proveedores Únicos"   valueSize="xl" value={String(data.top_suppliers.length)} icon={Building2} accent="info" />
                                            <StatCard label="Costo Total Comprado" valueSize="xl" value={formatCurrency(data.purchase_analysis.total_cost)} icon={Banknote} accent="warning" />
                                        </div>
                                    }
                                    chart={
                                        <StatCard label="Top Proveedores por Costo" variant="chart" className="h-full min-h-[300px]"
                                            chart={supplierBarData.length ? <AnalyticsChart type="bar-chart" preset="card" data={supplierBarData} keys={['Costo']} indexBy="name" valueFormat="$,.0f" /> : <EmptyChart />}
                                        />
                                    }
                                    table={
                                        <Collection.Root collection={topSupplierCollection}>
                                            <Collection.View table={topSupplierViews.table} emptyTitle="Sin compras registradas" emptyDescription="No hay proveedores con recepciones de este producto." />
                                        </Collection.Root>
                                    }
                                />
                            </div>

                        </div>
                    </DrawerLayout>
                )}
            </div>
        </div>
    )
}

// ─── Modal shell ──────────────────────────────────────────────────────────────

export function ProductAnalyticsModal({
    productId,
    productName,
    open,
    onOpenChange,
    onProductChange,
}: ProductAnalyticsModalProps) {
    return (
        <BaseModal
            open={open}
            onOpenChange={onOpenChange}
            icon={BarChart3}
            title="Análisis de producto"
            size="xl"
            hideScrollArea
            contentClassName="overflow-hidden"
        >
            <div className="h-[80vh] overflow-hidden flex flex-col">
                {productId && (
                    <ProductAnalyticsPanelInner
                        productId={productId}
                        productName={productName}
                        onProductChange={onProductChange}
                        onClose={() => onOpenChange(false)}
                    />
                )}
            </div>
        </BaseModal>
    )
}

// Compatibilidad temporal con importaciones existentes
export const ProductInsightsDrawer = ProductAnalyticsModal
