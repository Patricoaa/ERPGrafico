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
import api, { pollTask } from '@/lib/api';
import { TrendingUp, TrendingDown, Package, DollarSign, Users, ShoppingCart } from 'lucide-react';
import { CardSkeleton } from "@/components/shared";
import { EmptyState } from "@/components/shared/EmptyState";
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

                const res = await api.get('finances/api/bi-analytics/', { params });
                const finalData = res.data.task_id ? await pollTask(res.data.task_id) : res.data;
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
                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-l-4 border-l-info">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                        <DollarSign className="h-4 w-4 text-primary" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {sales.total_sales.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                        </div>
                        <div className="flex items-center text-xs text-success mt-1">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            +{sales.growth}% vs período anterior
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-l-4 border-l-success">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-success" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {sales.average_ticket.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {sales.sales_count} ventas realizadas
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-l-4 border-l-accent">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Valor Inventario</CardTitle>
                        <Package className="h-4 w-4 text-accent" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {inventory.total_value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {inventory.item_count} productos en stock
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-l-4 border-l-warning">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Rotación Inventario</CardTitle>
                        <TrendingUp className="h-4 w-4 text-warning" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{inventory.turnover_ratio}x</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {inventory.low_stock_alerts} alertas de stock bajo
                        </p>
                    </CardContent>
                </Card>
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
                            <Tooltip formatter={((value: number | string) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Ventas']) as any} />
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
                                <Tooltip formatter={((value: number | string) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Ventas']) as any} />
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
                                <Tooltip formatter={((value: number | string) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Valor']) as any} />
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
                                <span className="font-semibold">{performance.purchase_total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
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
                                <span className="font-semibold text-primary">{performance.ar_total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
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
                                <span className="font-semibold text-destructive">{performance.ap_total.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    );
};
