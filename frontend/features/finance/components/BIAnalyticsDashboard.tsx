"use client"

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useBIAnalytics } from "../hooks/useBIAnalytics";
import {TrendingUp, Package, DollarSign, ShoppingCart} from 'lucide-react';
import { EmptyState, MoneyDisplay, SkeletonShell, StatCard, LineChart, BarChart, PieChart } from '@/components/shared';
;
import { formatCurrency } from "@/lib/money";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

import { PageContainer } from "@/components/shared"

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
        efficiency: number;
        ar_total: number;
        ap_total: number;
    };
    production: {
        finished_wo: number;
        total_wo: number;
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

    const PLACEHOLDER = { sales: { total_sales: 0, growth: 0, average_ticket: 0, sales_count: 0, monthly_trend: [], top_customers: [] }, inventory: { total_value: 0, item_count: 0, turnover_ratio: 0, low_stock_alerts: 0, stock_distribution: [] }, performance: { purchase_total: 0, efficiency: 0, ar_total: 0, ap_total: 0 }, production: { finished_wo: 0, total_wo: 0 } };
    const d = data ?? PLACEHOLDER;
    const { sales, inventory, performance } = d;

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando analytics de negocio">
            <PageContainer>
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
            <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card">
                <CardHeader>
                    <CardTitle>Tendencia de Ventas</CardTitle>
                    <CardDescription>Evolución mensual de ventas</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px]">
                        <LineChart
                            data={[{ id: "Ventas Mensuales", data: inventory.monthly_trend as { x: string; y: number }[] }]}
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
                </CardContent>
            </Card>

            {/* Two column layout for detailed insights */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Top Customers */}
                <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card">
                    <CardHeader>
                        <CardTitle>Top 5 Clientes</CardTitle>
                        <CardDescription>Por volumen de ventas</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <BarChart
                            data={(inventory.top_customers || []).map((c: { name: string; amount: number }) => ({ name: c.name, amount: c.amount }))}
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
                    </CardContent>
                </Card>

                {/* Inventory Distribution */}
                <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card">
                    <CardHeader>
                        <CardTitle>Distribución de Inventario</CardTitle>
                        <CardDescription>Por categoría de producto</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <PieChart
                            data={(inventory.stock_distribution || []).map((d: { category: string; value: number }) => ({ id: d.category, value: d.value }))}
                            legends={[{
                                anchor: "bottom",
                                direction: "row",
                                translateY: 50,
                                itemWidth: 100,
                            }]}

                        />
                    </CardContent>
                </Card>
            </div>

            {/* Performance Insights Section */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card">
                    <CardHeader>
                        <CardTitle className="text-base">Análisis de Compras</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Volumen de Compra:</span>
                                <span className="font-semibold"><MoneyDisplay amount={performance.purchase_total} /></span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card">
                    <CardHeader>
                        <CardTitle className="text-base">Eficiencia Producción</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">OTs Completadas:</span>
                                <span className="font-semibold">{data.production.finished_wo} / {data.production.total_wo}</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Eficiencia:</span>
                                <span className="font-semibold text-success">{data.performance.efficiency}%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card">
                    <CardHeader>
                        <CardTitle className="text-base">Cuentas por Cobrar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Saldo Pendiente:</span>
                                <span className="font-semibold text-primary"><MoneyDisplay amount={performance.ar_total} /></span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card hover:shadow-elevated transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Cuentas por Pagar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Saldo Pendiente:</span>
                                <span className="font-semibold text-liability"><MoneyDisplay amount={performance.ap_total} /></span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
        </SkeletonShell>
    );
};
