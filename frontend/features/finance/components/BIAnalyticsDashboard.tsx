"use client"

import React from 'react';
import { useBIAnalytics } from "../hooks/useBIAnalytics";
import { Factory, Package, ShoppingCart, TrendingUp, Users, Truck } from 'lucide-react';
import { EmptyState, MoneyDisplay, PieChart, BarChart, LineChart, SkeletonShell, Metric, MetricStrip, StaleDataBanner, ChartCard } from '@/components/shared';
import { useMemo } from "react";
import { getChartPalette } from "@/lib/chart-colors";
import { formatCurrency, formatMoney, formatQuantity } from "@/lib/money";
import { format } from "date-fns";

const fmtPct = (v: number | undefined) => `${(v ?? 0).toFixed(1)}%`;
import { type DateRange } from "react-day-picker";

interface BIAnalyticsDashboardProps {
    date?: DateRange;
    showComparison?: boolean;
    compDate?: DateRange;
}

interface BIAnalyticsData {
    sales: {
        total_sales: number;
        prev_total_sales: number;
        sales_count: number;
        growth: number;
        monthly_trend: Array<{ month: string; sales: number }>;
        top_customers: Array<{ name: string; amount: number }>;
        sales_by_channel: Array<{ channel: string; total: number; count: number }>;
        pending_deliveries: number;
        invoiced_period: number;
    };
    purchasing: {
        purchase_total: number;
        purchase_count: number;
        status_distribution: Array<{ status: string; count: number; total: number }>;
        top_suppliers: Array<{ name: string; amount: number }>;
    };
    inventory: {
        total_value: number;
        item_count: number;
        stock_distribution: Array<{ category: string; value: number; items: number }>;
    };
    production: {
        total_wo: number;
        finished_wo: number;
        in_progress_wo: number;
        efficiency: number;
        stage_distribution: Array<{ stage: string; count: number }>;
    };
    billing: {
        ar_total: number;
        ap_total: number;
    };
    treasury: {
        cash_inbound: number;
        cash_outbound: number;
        net_cash_flow: number;
        cash_flow_trend: Array<{ month: string; ingresos: number; egresos: number }>;
    };
    payroll: {
        total_cost: number;
        employee_count: number;
    };
}

export const BIAnalyticsDashboard: React.FC<BIAnalyticsDashboardProps> = ({ date, showComparison, compDate }) => {
    const params: Record<string, unknown> = {
        is_async: false,
        ...(date?.to && { end_date: format(date.to, 'yyyy-MM-dd') }),
        ...(date?.from && { start_date: format(date.from, 'yyyy-MM-dd') }),
    }

    const compParams: Record<string, unknown> | undefined = showComparison ? {
        is_async: false,
        ...(compDate?.to && { end_date: format(compDate.to, 'yyyy-MM-dd') }),
        ...(compDate?.from && { start_date: format(compDate.from, 'yyyy-MM-dd') }),
    } : undefined

    const { data, isLoading, isError } = useBIAnalytics(params)
    const { data: compData } = useBIAnalytics(compParams)
    const palette = useMemo(() => getChartPalette(), []);

    if (!data && !isLoading) return <EmptyState context="finance" variant="compact" description="No hay datos disponibles para el período seleccionado" />;

    const PLACEHOLDER: BIAnalyticsData = { 
        sales: { total_sales: 0, prev_total_sales: 0, sales_count: 0, growth: 0, monthly_trend: [], top_customers: [], sales_by_channel: [], pending_deliveries: 0, invoiced_period: 0 }, 
        purchasing: { purchase_total: 0, purchase_count: 0, status_distribution: [], top_suppliers: [] },
        inventory: { total_value: 0, item_count: 0, stock_distribution: [] }, 
        production: { total_wo: 0, finished_wo: 0, in_progress_wo: 0, efficiency: 0, stage_distribution: [] },
        billing: { ar_total: 0, ap_total: 0 },
        treasury: { cash_inbound: 0, cash_outbound: 0, net_cash_flow: 0, cash_flow_trend: [] },
        payroll: { total_cost: 0, employee_count: 0 }
    };
    const d = (data ?? PLACEHOLDER) as BIAnalyticsData;
    const cd = compData as BIAnalyticsData | undefined;

    const sales = d.sales ?? PLACEHOLDER.sales;
    const purchasing = d.purchasing ?? PLACEHOLDER.purchasing;
    const inventory = d.inventory ?? PLACEHOLDER.inventory;
    const production = d.production ?? PLACEHOLDER.production;
    const billing = d.billing ?? PLACEHOLDER.billing;
    const payroll = d.payroll ?? PLACEHOLDER.payroll;

    // Line Chart: Trend (Ventas Mensuales)
    const salesTrendData = [
        { id: "Ventas", data: (sales.monthly_trend || []).map(m => ({ x: String(m.month || ""), y: Number(m.sales) || 0 })) }
    ];
    
    // Nivo LineChart crashes with NaN if there's only 1 point or if all Y values are identical (e.g., all 0) and yScale is auto.
    const hasValidTrend = salesTrendData[0].data.length > 1 && Math.max(...salesTrendData[0].data.map(d => d.y)) > 0;

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando analytics de negocio">
            {isError && <StaleDataBanner className="mx-4 mt-2" />}
            
            {/* ── Row 1: KPI Overview Cards ── */}
            <MetricStrip label="Indicadores del negocio">
                <Metric
                    label="Ingresos por Ventas"
                    info="Monto total de ventas confirmadas en el período seleccionado. No incluye impuestos."
                    lead={TrendingUp}
                    value={formatMoney(sales.total_sales)}
                    delta={showComparison && cd?.sales?.total_sales !== undefined ? { current: sales.total_sales, previous: cd?.sales?.total_sales } : undefined}
                    context={`${sales.growth >= 0 ? "+" : "−"}${Math.abs(sales.growth)}% vs período anterior`}
                />
                <Metric
                    label="Volumen de Compras"
                    info="Suma total neta de todas las órdenes de compra confirmadas durante este período."
                    lead={ShoppingCart}
                    value={formatMoney(purchasing.purchase_total)}
                    delta={showComparison && cd?.purchasing?.purchase_total !== undefined ? { current: purchasing.purchase_total, previous: cd?.purchasing?.purchase_total, inverse: true } : undefined}
                    context={undefined}
                />
                <Metric
                    label="Masa Salarial (Nómina)"
                    info="Costo total de la masa salarial (Haberes totales) de las liquidaciones emitidas durante los meses que cruza el período seleccionado."
                    lead={Users}
                    value={formatMoney(payroll.total_cost)}
                    delta={showComparison && cd?.payroll?.total_cost !== undefined ? { current: payroll.total_cost, previous: cd?.payroll?.total_cost, inverse: true } : undefined}
                    context={`${payroll.employee_count} empleados`}
                />
                <Metric
                    label="Eficiencia Producción"
                    info="Porcentaje de órdenes de trabajo (OTs) completadas respecto del total de OTs creadas en el período."
                    lead={Factory}
                    value={fmtPct(production.efficiency)}
                    delta={showComparison && cd?.production?.efficiency !== undefined ? { current: production.efficiency, previous: cd?.production?.efficiency } : undefined}
                    context={`${production.finished_wo} completadas`}
                />
                <Metric
                    label="Valoración Inventario"
                    info="Valoración actual del inventario de productos almacenables, a costo promedio / precio de costo."
                    lead={Package}
                    value={formatMoney(inventory.total_value)}
                    delta={showComparison && cd?.inventory?.total_value !== undefined ? { current: inventory.total_value, previous: cd?.inventory?.total_value } : undefined}
                    context={`${inventory.item_count} SKU activos`}
                />
                <Metric
                    label="Despachos Pendientes"
                    info="Cantidad de ventas confirmadas que todavía no han sido despachadas en su totalidad al cliente."
                    lead={Truck}
                    value={formatQuantity(sales.pending_deliveries)}
                    delta={showComparison && cd?.sales?.pending_deliveries !== undefined ? { current: sales.pending_deliveries, previous: cd?.sales?.pending_deliveries, inverse: true } : undefined}
                    context={"órdenes en espera"}
                />
            </MetricStrip>

            {/* ── Row 2: Cash Flow and Sales Trend ── */}
            <div className="grid gap-6 md:grid-cols-2 mt-6">
                <ChartCard 
                    bodyClassName="h-80"
                    title="Tendencia de Ventas" 
                    subtitle="Evolución mensual de ventas (sin impuestos)"
                    legend={hasValidTrend ? [{ label: "Ventas", color: palette[0] }] : undefined}
                >
                    <div className="h-full">
                        {hasValidTrend ? (
                            <LineChart
                                data={salesTrendData}
                                margin={{ top: 10, right: 20, bottom: 20, left: 60 }}
                                yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false, reverse: false }}
                                axisBottom={{ tickSize: 0, tickPadding: 12 }}
                                axisLeft={{
                                    tickSize: 0,
                                    tickPadding: 12,
                                    format: (v: number) => formatCurrency(v),
                                }}
                                legends={[]}
                                colors={palette}
                                tooltipFormat="currency"
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-center text-muted-foreground">
                                Datos insuficientes para gráfica de tendencia<br/>(se requiere más de un mes)
                            </div>
                        )}
                    </div>
                </ChartCard>

                <ChartCard
                    bodyClassName="h-80"
                    title="Top Clientes"
                    subtitle="Por volumen de compras facturadas"
                >
                    <div className="h-full">
                        {sales.top_customers && sales.top_customers.length > 0 ? (
                            <BarChart
                                data={(sales.top_customers || []).map(c => ({ name: c.name, amount: c.amount }))}
                                keys={["amount"]}
                                indexBy="name"
                                layout="horizontal"
                                margin={{ top: 10, right: 20, bottom: 20, left: 100 }}
                                axisBottom={{
                                    tickSize: 0,
                                    tickPadding: 12,
                                    format: (v: number) => formatCurrency(v),
                                }}
                                axisLeft={{ tickSize: 0, tickPadding: 12 }}
                                colors={palette}
                                renderTooltip={({ indexValue, value }) => (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-medium">{String(indexValue)}</span>
                                        <span className="font-bold">{formatMoney(value as number)}</span>
                                    </div>
                                )}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                No hay ventas en el periodo
                            </div>
                        )}
                    </div>
                </ChartCard>
            </div>

            {/* ── Row 3: Insights by Module ── */}
            <div className="grid gap-6 md:grid-cols-3 mt-6">
                {/* 1. Compras y CxP */}
                <ChartCard
                    title="Proveedores y CxP"
                    subtitle="Análisis de pasivos y principales proveedores"
                    bodyClassName="h-auto"
                    className="h-full"
                >
                    <div className="space-y-4 flex-1">
                        <div className="flex flex-col bg-muted/30 p-3 rounded-md border border-border/50">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cuentas por Pagar (Facturas Pendientes)</span>
                            <span className="text-2xl font-bold text-liability mt-1">
                                <MoneyDisplay amount={billing.ap_total} />
                            </span>
                        </div>

                        <div>
                            <span className="text-3xs font-bold uppercase tracking-widest text-muted-foreground">Top 3 Proveedores</span>
                            <div className="mt-2 space-y-2">
                                {(purchasing.top_suppliers || []).slice(0, 3).map((s, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className="truncate pr-2">{s.name}</span>
                                        <span className="tabular-nums"><MoneyDisplay amount={s.amount} weight="semibold" /></span>
                                    </div>
                                ))}
                                {(!purchasing.top_suppliers || purchasing.top_suppliers.length === 0) && (
                                    <span className="text-xs text-muted-foreground italic">No hay información</span>
                                )}
                            </div>
                        </div>
                    </div>
                </ChartCard>

                {/* 2. Inventario */}
                <ChartCard
                    title="Inventario"
                    subtitle="Composición del valor en almacén por categoría"
                    bodyClassName="h-auto"
                    className="h-full flex flex-col"
                >
                    <div className="h-[220px] -mx-2">
                        {inventory.stock_distribution && inventory.stock_distribution.length > 0 ? (
                            <PieChart
                                data={(inventory.stock_distribution || []).map(d => ({ id: d.category, value: d.value, items: d.items }))}
                                enableArcLabels={false}
                                innerRadius={0.6}
                                margin={{ top: 10, right: 10, bottom: 20, left: 10 }}
                                legends={[]}
                                renderTooltip={(data) => (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-medium">{String(data.id)}</span>
                                        <span className="font-bold">{formatMoney(data.value)}</span>
                                    </div>
                                )}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                                Sin inventario valorizado
                            </div>
                        )}
                    </div>
                    <div className="mt-auto space-y-1 overflow-y-auto max-h-[80px]">
                        {(inventory.stock_distribution || [])
                            .sort((a,b) => b.value - a.value)
                            .slice(0, 4)
                            .map((d, i) => (
                            <div key={i} className="flex justify-between items-center text-2xs">
                                <span className="truncate font-medium">{d.category}</span>
                                <span className="text-muted-foreground">{formatMoney(d.value)}</span>
                            </div>
                        ))}
                    </div>
                </ChartCard>

                {/* 3. Ventas y CxC */}
                <ChartCard
                    title="Cuentas por Cobrar"
                    subtitle="Facturas emitidas y pendientes de cobro"
                    bodyClassName="h-auto"
                    className="h-full"
                >
                    <div className="space-y-4 flex-1">
                        <div className="flex flex-col bg-muted/30 p-3 rounded-md border border-border/50">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monto Pendiente</span>
                            <span className="text-2xl font-bold text-primary mt-1">
                                <MoneyDisplay amount={billing.ar_total} />
                            </span>
                        </div>
                        
                        <div className="flex flex-col bg-muted/30 p-3 rounded-md border border-border/50">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Facturado en el Período</span>
                            <span className="text-2xl font-bold mt-1">
                                <MoneyDisplay amount={sales.invoiced_period} />
                            </span>
                        </div>
                    </div>
                </ChartCard>
            </div>

        </SkeletonShell>
    );
};
