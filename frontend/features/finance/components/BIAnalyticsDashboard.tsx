"use client"

import React from 'react';
import { useBIAnalytics } from "../hooks/useBIAnalytics";
import { Factory, Package, TrendingUp, TrendingDown, Users, Truck } from 'lucide-react';
import { EmptyState, MoneyDisplay, PieChart, BarChart, LineChart, SkeletonShell, StatCard, StaleDataBanner, KPIWrapper, KPIValue, DeltaBadge, SectionCard, ChartLegend } from '@/components/shared';
import { useMemo } from "react";
import { getChartPalette } from "@/lib/chart-colors";
import { formatCurrency, formatMoney } from "@/lib/money";
import { format } from "date-fns";
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
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                
                {/* Ingresos (Ventas) */}
                <KPIWrapper tooltip="Monto total de ventas confirmadas en el período seleccionado. No incluye impuestos.">
                    <StatCard
                        label="Ingresos por Ventas"
                        value={<KPIValue current={sales.total_sales} previous={cd?.sales?.total_sales} showComparison={showComparison} isCurrency />}
                        valueSize="xl"
                        accent="primary"
                        className="h-full rounded-md"
                    >
                        <div className={`mt-1.5 flex items-center gap-1 text-3xs font-bold ${sales.growth >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {sales.growth >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {Math.abs(sales.growth)}% vs período anterior
                        </div>
                    </StatCard>
                </KPIWrapper>

                {/* Volumen de Compra */}
                <KPIWrapper tooltip="Suma total neta de todas las órdenes de compra confirmadas durante este período.">
                    <StatCard
                        label="Volumen de Compras"
                        value={<KPIValue current={purchasing.purchase_total} previous={cd?.purchasing?.purchase_total} showComparison={showComparison} isCurrency />}
                        valueSize="xl"
                        accent="warning"
                        className="h-full rounded-md"
                    >
                        {showComparison && cd && (
                            <div className="mt-1.5 flex items-center gap-1 text-3xs font-bold">
                                Variación: <DeltaBadge current={purchasing.purchase_total} previous={cd?.purchasing?.purchase_total} inverse />
                            </div>
                        )}
                    </StatCard>
                </KPIWrapper>

                {/* Nómina (Masa Salarial) */}
                <KPIWrapper tooltip="Costo total de la masa salarial (Haberes totales) de las liquidaciones emitidas durante los meses que cruza el período seleccionado.">
                    <StatCard
                        label="Masa Salarial (Nómina)"
                        value={<KPIValue current={payroll.total_cost} previous={cd?.payroll?.total_cost} showComparison={showComparison} isCurrency />}
                        valueSize="xl"
                        accent="destructive"
                        className="h-full rounded-md"
                    >
                        <div className="mt-1.5 flex items-center gap-1 text-3xs font-bold text-muted-foreground">
                            <Users className="h-3 w-3" /> {payroll.employee_count} empleados
                        </div>
                    </StatCard>
                </KPIWrapper>

                {/* Eficiencia Producción */}
                <KPIWrapper tooltip="Porcentaje de órdenes de trabajo (OTs) completadas respecto del total de OTs creadas en el período.">
                    <StatCard
                        label="Eficiencia Producción"
                        value={<KPIValue current={production.efficiency} previous={cd?.production?.efficiency} showComparison={showComparison} isPercentage />}
                        valueSize="xl"
                        accent="info"
                        className="h-full rounded-md"
                    >
                        <div className="mt-1.5 flex items-center gap-1 text-3xs font-bold text-muted-foreground">
                            <Factory className="h-3 w-3" /> {production.finished_wo} completadas
                        </div>
                    </StatCard>
                </KPIWrapper>

                {/* Valor de Inventario */}
                <KPIWrapper tooltip="Valoración actual del inventario de productos almacenables, a costo promedio / precio de costo.">
                    <StatCard
                        label="Valoración Inventario"
                        value={<KPIValue current={inventory.total_value} previous={cd?.inventory?.total_value} showComparison={showComparison} isCurrency />}
                        valueSize="xl"
                        accent="accent"
                        className="h-full rounded-md"
                    >
                        <div className="mt-1.5 flex items-center gap-1 text-3xs font-bold text-muted-foreground">
                            <Package className="h-3 w-3" /> {inventory.item_count} SKU activos
                        </div>
                    </StatCard>
                </KPIWrapper>

                {/* Despachos Pendientes */}
                <KPIWrapper tooltip="Cantidad de ventas confirmadas que todavía no han sido despachadas en su totalidad al cliente.">
                    <StatCard
                        label="Despachos Pendientes"
                        value={<KPIValue current={sales.pending_deliveries} previous={cd?.sales?.pending_deliveries} showComparison={showComparison} />}
                        valueSize="xl"
                        accent="accent"
                        className="h-full rounded-md"
                    >
                        <div className="mt-1.5 flex items-center gap-1 text-3xs font-bold text-muted-foreground">
                            <Truck className="h-3 w-3" /> órdenes en espera
                        </div>
                    </StatCard>
                </KPIWrapper>
            </div>

            {/* ── Row 2: Cash Flow and Sales Trend ── */}
            <div className="grid gap-6 md:grid-cols-2 mt-6">
                <SectionCard 
                    title="Tendencia de Ventas" 
                    description="Evolución mensual de ventas (sin impuestos)"
                    headerRight={hasValidTrend ? <ChartLegend items={[{ label: "Ventas", color: palette[0] }]} /> : undefined}
                    className="rounded-md"
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
                </SectionCard>

                <SectionCard
                    title="Top Clientes"
                    description="Por volumen de compras facturadas"
                    className="rounded-md"
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
                </SectionCard>
            </div>

            {/* ── Row 3: Insights by Module ── */}
            <div className="grid gap-6 md:grid-cols-3 mt-6">
                {/* 1. Compras y CxP */}
                <SectionCard
                    title="Proveedores y CxP"
                    description="Análisis de pasivos y principales proveedores"
                    chartHeight="auto"
                    className="h-full rounded-md"
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
                </SectionCard>

                {/* 2. Inventario */}
                <SectionCard
                    title="Inventario"
                    description="Composición del valor en almacén por categoría"
                    chartHeight="auto"
                    className="h-full flex flex-col rounded-md"
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
                </SectionCard>

                {/* 3. Ventas y CxC */}
                <SectionCard
                    title="Cuentas por Cobrar"
                    description="Facturas emitidas y pendientes de cobro"
                    chartHeight="auto"
                    className="h-full rounded-md"
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
                </SectionCard>
            </div>

        </SkeletonShell>
    );
};
