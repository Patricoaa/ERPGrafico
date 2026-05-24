"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    BarChart,
    Bar,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import { financeApi } from "../api/financeApi";
import { TrendingUp, TrendingDown, Package, DollarSign, ShoppingCart } from 'lucide-react';
import { CardSkeleton, MoneyDisplay, StatCard } from "@/components/shared";
import { EmptyState } from "@/components/shared/EmptyState";
import { formatCurrency } from "@/lib/money";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

import { PageContainer } from "@/components/shared"

const COLORS = ['var(--primary)', 'var(--accent)', 'var(--secondary)', 'var(--muted-foreground)', 'var(--warning)', 'var(--destructive)'];

interface BIAnalyticsViewProps {
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

export const BIAnalyticsView: React.FC<BIAnalyticsViewProps> = ({ date }) => {
    const [data, setData] = useState<BIAnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const params: Record<string, unknown> = { is_async: true };
                if (date?.to) params.end_date = format(date.to, 'yyyy-MM-dd');
                if (date?.from) params.start_date = format(date.from, 'yyyy-MM-dd');

                const finalData = await financeApi.getBIAnalytics(params);
                setData(finalData);
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [date]);

    if (loading) return <CardSkeleton variant="grid" count={4} />;
    if (!data) return <EmptyState context="finance" variant="compact" description="No hay datos disponibles para el período seleccionado" />;

    const { sales, inventory, performance } = data;

    return (
        <PageContainer>
            {/* KPI Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <StatCard
                    label="Ventas Totales"
                    value={<MoneyDisplay amount={sales.total_sales} digits={0} />}
                    icon={DollarSign}
                    trend={{ direction: "up", value: `+${sales.growth}% vs período anterior` }}
                    accent="info"
                />
                <StatCard
                    label="Ticket Promedio"
                    value={<MoneyDisplay amount={sales.average_ticket} digits={0} />}
                    icon={ShoppingCart}
                    subtext={`${sales.sales_count} ventas realizadas`}
                    accent="success"
                />
                <StatCard
                    label="Valor Inventario"
                    value={<MoneyDisplay amount={inventory.total_value} digits={0} />}
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
            <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card">
                <CardHeader>
                    <CardTitle>Tendencia de Ventas</CardTitle>
                    <CardDescription>Evolución mensual de ventas</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={sales.monthly_trend || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <Tooltip formatter={((value: number | string) => [formatCurrency(value), 'Ventas']) as any} />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="sales"
                                stroke={COLORS[0]}
                                strokeWidth={3}
                                name="Ventas Mensuales"
                                dot={{ r: 6 }}
                                activeDot={{ r: 8 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Two column layout for detailed insights */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Top Customers */}
                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card">
                    <CardHeader>
                        <CardTitle>Top 5 Clientes</CardTitle>
                        <CardDescription>Por volumen de ventas</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={sales.top_customers || []} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip formatter={((value: number | string) => [formatCurrency(value), 'Ventas']) as any} />
                                <Bar dataKey="amount" fill={COLORS[1]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Inventory Distribution */}
                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card">
                    <CardHeader>
                        <CardTitle>Distribución de Inventario</CardTitle>
                        <CardDescription>Por categoría de producto</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={inventory.stock_distribution || []}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={((entry: any) => `${entry.category}`) as any}
                                    outerRadius={80}
                                    fill="var(--primary)"
                                    dataKey="value"
                                >
                                    {(inventory.stock_distribution || []).map((_entry, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={((value: number | string) => [formatCurrency(value), 'Valor']) as any} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Performance Insights Section */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card">
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

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card">
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

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card">
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

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Cuentas por Pagar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Saldo Pendiente:</span>
                                <span className="font-semibold text-destructive"><MoneyDisplay amount={performance.ap_total} /></span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    );
};
