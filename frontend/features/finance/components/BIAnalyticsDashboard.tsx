"use client"

import React from 'react';
import { useBIAnalytics } from "../hooks/useBIAnalytics";
import {TrendingUp, Package, DollarSign, ShoppingCart} from 'lucide-react';
import { EmptyState, MoneyDisplay, SkeletonShell, StatCard, LineChart, BarChart, PieChart } from '@/components/shared';

import { formatCurrency } from "@/lib/money";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";

interface BIAnalyticsDashboardProps {
    date?: DateRange;
}

interface BIAnalyticsData {
    sales: {
        total_sales: number;
        growth: number;
        average_ticket: number;
        sales_count: number;
        monthly_trend: Array<{ month: string; sales: number }>;
        top_customers: Array<{ name: string; amount: number }>;
    };
    inventory: {
        total_value: number;
        item_count: number;
        turnover_ratio: number;
        low_stock_alerts: number;
        stock_distribution: Array<{ category: string; value: number }>;
    };
    performance: {
        purchase_total: number;
        ar_total: number;
        ap_total: number;
    };
    production: {
        finished_wo: number;
        total_wo: number;
        efficiency: number;
    };
}

export const BIAnalyticsDashboard: React.FC<BIAnalyticsDashboardProps> = ({ date }) => {
    const params: Record<string, unknown> = {
        is_async: true,
        ...(date?.to && { end_date: format(date.to, 'yyyy-MM-dd') }),
        ...(date?.from && { start_date: format(date.from, 'yyyy-MM-dd') }),
    }

    const { data, isLoading, isError } = useBIAnalytics(params)

    if (isError) return <EmptyState context="finance" variant="compact" title="Error al cargar analytics" description="No se pudieron cargar los datos de inteligencia de negocio." />;
    if (!data && !isLoading) return <EmptyState context="finance" variant="compact" description="No hay datos disponibles para el período seleccionado" />;

    const PLACEHOLDER = { sales: { total_sales: 0, growth: 0, average_ticket: 0, sales_count: 0, monthly_trend: [], top_customers: [] }, inventory: { total_value: 0, item_count: 0, turnover_ratio: 0, low_stock_alerts: 0, stock_distribution: [] }, performance: { purchase_total: 0, ar_total: 0, ap_total: 0 }, production: { finished_wo: 0, total_wo: 0, efficiency: 0 } };
    const d = (data ?? PLACEHOLDER) as BIAnalyticsData;
    const { sales, inventory, performance, production } = d;

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando analytics de negocio">
            {/* KPI Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Ventas Totales"
                    value={<MoneyDisplay amount={sales.total_sales} />}
                    icon={DollarSign}
                    trend={{ direction: "up", value: `+${sales.growth}% vs período anterior` }}
                    accent="info"
                />
                <StatCard
                    label="Ticket Promedio"
                    value={<MoneyDisplay amount={sales.average_ticket} />}
                    icon={ShoppingCart}
                    subtext={`${sales.sales_count} ventas realizadas`}
                    accent="success"
                />
                <StatCard
                    label="Valor Inventario"
                    value={<MoneyDisplay amount={inventory.total_value} />}
                    icon={Package}
                    subtext={`${inventory.item_count} productos en stock`}
                    accent="accent"
                />
                <StatCard
                    label="Rotación Inventario"
                    value={`${inventory.turnover_ratio}x`}
                    icon={TrendingUp}
                    subtext={`${inventory.low_stock_alerts} alertas de stock bajo`}
                    accent="warning"
                />
            </div>

            {/* Sales Trend */}
            <div className="flex flex-col">
                <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Tendencia de Ventas</h3>
                <span className="text-[10px] text-muted-foreground/70 mb-3">Evolución mensual de ventas</span>
                <div className="h-[350px]">
                        <LineChart
                            data={[{ id: "Ventas Mensuales", data: (sales.monthly_trend || []).map((m: { month: string; sales: number }) => ({ x: m.month, y: m.sales })) }]}
                            margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                            axisBottom={{
                                tickSize: 0,
                                tickPadding: 12,
                            }}
                            axisLeft={{
                                tickSize: 0,
                                tickPadding: 12,
                                format: (v: number) => formatCurrency(v),
                            }}
                            legends={[{
                                anchor: "bottom",
                                direction: "row",
                                translateY: 50,
                                itemWidth: 130,
                                symbolSize: 12,
                            }]}
                        />
                </div>
            </div>

            {/* Two column layout for detailed insights */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Top Customers */}
                <div className="flex flex-col">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Top 5 Clientes</h3>
                    <span className="text-[10px] text-muted-foreground/70 mb-3">Por volumen de ventas</span>
                    <div className="h-[300px]">
                        <BarChart
                            data={(sales.top_customers || []).map((c: { name: string; amount: number }) => ({ name: c.name, amount: c.amount }))}
                            keys={["amount"]}
                            indexBy="name"
                            layout="horizontal"
                            axisBottom={{
                                tickSize: 0,
                                tickPadding: 12,
                                format: (v: number) => formatCurrency(v),
                            }}
                            axisLeft={{
                                tickSize: 0,
                                tickPadding: 12,
                            }}
                        />
                    </div>
                </div>

                {/* Inventory Distribution */}
                <div className="flex flex-col">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Distribución de Inventario</h3>
                    <span className="text-[10px] text-muted-foreground/70 mb-3">Por categoría de producto</span>
                    <div className="h-[300px]">
                        <PieChart
                            data={(inventory.stock_distribution || []).map((d: { category: string; value: number }) => ({ id: d.category, value: d.value }))}
                            legends={[{
                                anchor: "bottom",
                                direction: "row",
                                translateY: 50,
                                itemWidth: 100,
                            }]}

                        />
                    </div>
                </div>
            </div>

            {/* Performance Insights Section */}
            <div className="grid gap-6 md:grid-cols-4">
                <div className="flex flex-col">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Análisis de Compras</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Volumen de Compra:</span>
                            <span className="text-xs font-semibold"><MoneyDisplay amount={performance.purchase_total} /></span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Eficiencia Producción</h3>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">OTs Completadas:</span>
                            <span className="text-xs font-semibold">{production.finished_wo} / {production.total_wo}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Eficiencia:</span>
                            <span className="text-xs font-semibold text-success">{production.efficiency}%</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Cuentas por Cobrar</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Saldo Pendiente:</span>
                            <span className="text-xs font-semibold text-primary"><MoneyDisplay amount={performance.ar_total} /></span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-2">Cuentas por Pagar</h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs text-muted-foreground">Saldo Pendiente:</span>
                            <span className="text-xs font-semibold text-liability"><MoneyDisplay amount={performance.ap_total} /></span>
                        </div>
                    </div>
                </div>
            </div>
        </SkeletonShell>
    );
};
