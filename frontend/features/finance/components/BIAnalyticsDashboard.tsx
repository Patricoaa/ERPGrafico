"use client"

import React from 'react';
import { useBIAnalytics } from "../hooks/useBIAnalytics";
import { DollarSign, Factory, Package, CreditCard, TrendingUp, TrendingDown, Info, Wallet, Users, LayoutDashboard, ShoppingCart, Truck } from 'lucide-react';
import { EmptyState, MoneyDisplay, SkeletonShell, StatCard, LineChart, BarChart, PieChart, StaleDataBanner } from '@/components/shared';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatCurrency, formatMoney } from "@/lib/money";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";

function KPIWrapper({ tooltip, children }: { tooltip: string, children: React.ReactNode }) {
    return (
        <TooltipProvider>
            <Tooltip delayDuration={150}>
                <TooltipTrigger asChild>
                    <div className="cursor-help flex flex-col h-full hover:brightness-95 dark:hover:brightness-110 transition-all">
                        {children}
                    </div>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[300px] p-3 text-balance">
                    <p className="text-xs leading-relaxed">{tooltip}</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}

function KPIValue({ current, previous, showComparison, isPercentage = false, isCurrency = false }: { current: number, previous?: number, showComparison?: boolean, isPercentage?: boolean, isCurrency?: boolean }) {
    const format = (v: number | undefined) => {
        const val = v ? Number(v) : 0;
        if (isPercentage) return `${val.toFixed(1)}%`;
        if (isCurrency) return formatMoney(val);
        return val.toFixed(0);
    };
    
    if (!showComparison || previous === undefined) {
        return <>{format(current)}</>;
    }
    
    return (
        <div className="flex flex-col gap-1.5 mt-1">
            <div className="flex items-baseline gap-2 leading-none">
                <span>{format(current)}</span>
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">Actual</span>
            </div>
            <div className="flex items-baseline gap-2 text-lg text-muted-foreground/90 leading-none">
                <span>{format(previous)}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest">Anterior</span>
            </div>
        </div>
    );
}

function DeltaBadge({ current, previous, inverse = false }: { current: number; previous: number, inverse?: boolean }) {
    if (!previous) return null
    const delta = ((current - previous) / Math.abs(previous)) * 100
    let isPositive = delta >= 0
    if (inverse) isPositive = !isPositive;
    
    return (
        <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
            {delta >= 0 ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
            {Math.abs(delta).toFixed(1)}%
        </span>
    )
}

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
    const treasury = d.treasury ?? PLACEHOLDER.treasury;
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
                        className="h-full"
                    >
                        <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${sales.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
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
                        className="h-full"
                    >
                        {showComparison && cd && (
                            <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold">
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
                        className="h-full"
                    >
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
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
                        className="h-full"
                    >
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
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
                        className="h-full"
                    >
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
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
                        className="h-full"
                    >
                        <div className="mt-1.5 flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                            <Truck className="h-3 w-3" /> órdenes en espera
                        </div>
                    </StatCard>
                </KPIWrapper>
            </div>

            {/* ── Row 2: Cash Flow and Sales Trend ── */}
            <div className="grid gap-6 md:grid-cols-2 mt-6">
                <div className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-base font-bold text-foreground">Tendencia de Ventas</h3>
                    <span className="text-sm text-muted-foreground mb-4">Evolución mensual de ventas (sin impuestos)</span>
                    <div className="h-[320px]">
                        {hasValidTrend ? (
                            <LineChart
                                data={salesTrendData}
                                margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                                yScale={{ type: 'linear', min: 0, max: 'auto', stacked: false, reverse: false }}
                                axisBottom={{ tickSize: 0, tickPadding: 12 }}
                                axisLeft={{
                                    tickSize: 0,
                                    tickPadding: 12,
                                    format: (v: number) => formatCurrency(v),
                                }}
                                legends={[{
                                    anchor: "bottom",
                                    direction: "row",
                                    translateY: 50,
                                    itemWidth: 100,
                                    symbolSize: 12,
                                }]}
                                colors={{ scheme: 'category10' }}
                            />
                        ) : (
                            <div className="flex h-full items-center justify-center text-sm text-center text-muted-foreground">
                                Datos insuficientes para gráfica de tendencia<br/>(se requiere más de un mes)
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-base font-bold text-foreground">Top Clientes</h3>
                    <span className="text-sm text-muted-foreground mb-4">Por volumen de compras facturadas</span>
                    <div className="h-[320px]">
                        {sales.top_customers && sales.top_customers.length > 0 ? (
                            <BarChart
                                data={(sales.top_customers || []).map(c => ({ name: c.name, amount: c.amount }))}
                                keys={["amount"]}
                                indexBy="name"
                                layout="horizontal"
                                margin={{ top: 20, right: 20, bottom: 40, left: 100 }}
                                axisBottom={{
                                    tickSize: 0,
                                    tickPadding: 12,
                                    format: (v: number) => formatCurrency(v),
                                }}
                                axisLeft={{ tickSize: 0, tickPadding: 12 }}
                                colors={{ scheme: 'set2' }}
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
                </div>
            </div>

            {/* ── Row 3: Insights by Module ── */}
            <div className="grid gap-6 md:grid-cols-3 mt-6">
                {/* 1. Compras y CxP */}
                <div className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-base font-bold text-foreground mb-1">Proveedores y CxP</h3>
                    <span className="text-xs text-muted-foreground mb-4">Análisis de pasivos y principales proveedores</span>
                    
                    <div className="space-y-4 flex-1">
                        <div className="flex flex-col bg-muted/30 p-3 rounded-lg border border-border/50">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Cuentas por Pagar (Facturas Pendientes)</span>
                            <span className="text-2xl font-bold text-liability mt-1">
                                <MoneyDisplay amount={billing.ap_total} />
                            </span>
                        </div>

                        <div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Top 3 Proveedores</span>
                            <div className="mt-2 space-y-2">
                                {(purchasing.top_suppliers || []).slice(0, 3).map((s, i) => (
                                    <div key={i} className="flex justify-between items-center text-sm">
                                        <span className="truncate pr-2">{s.name}</span>
                                        <span className="font-semibold tabular-nums"><MoneyDisplay amount={s.amount} /></span>
                                    </div>
                                ))}
                                {(!purchasing.top_suppliers || purchasing.top_suppliers.length === 0) && (
                                    <span className="text-xs text-muted-foreground italic">No hay información</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* 2. Inventario */}
                <div className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-base font-bold text-foreground mb-1">Inventario</h3>
                    <span className="text-xs text-muted-foreground mb-4">Composición del valor en almacén por categoría</span>
                    
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
                            <div key={i} className="flex justify-between items-center text-[11px]">
                                <span className="truncate font-medium">{d.category}</span>
                                <span className="text-muted-foreground">{formatMoney(d.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* 3. Ventas y CxC */}
                <div className="flex flex-col rounded-xl border bg-card p-5 shadow-sm">
                    <h3 className="text-base font-bold text-foreground mb-1">Cuentas por Cobrar</h3>
                    <span className="text-xs text-muted-foreground mb-4">Facturas emitidas y pendientes de cobro</span>
                    
                    <div className="space-y-4 flex-1">
                        <div className="flex flex-col bg-muted/30 p-3 rounded-lg border border-border/50">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Monto Pendiente</span>
                            <span className="text-2xl font-bold text-primary mt-1">
                                <MoneyDisplay amount={billing.ar_total} />
                            </span>
                        </div>
                        
                        <div className="flex flex-col bg-muted/30 p-3 rounded-lg border border-border/50">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Facturado en el Período</span>
                            <span className="text-2xl font-bold mt-1">
                                <MoneyDisplay amount={sales.invoiced_period} />
                            </span>
                        </div>
                    </div>
                </div>
            </div>

        </SkeletonShell>
    );
};
