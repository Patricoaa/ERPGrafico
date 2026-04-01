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
import api from '@/lib/api';
import { TrendingUp, TrendingDown, Package, DollarSign, Users, ShoppingCart } from 'lucide-react';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

import { IndustrialCard } from "@/components/shared/IndustrialCard";
import { LAYOUT_TOKENS } from "@/lib/styles";

const COLORS = ['var(--primary)', 'var(--accent)', 'var(--secondary)', 'var(--muted-foreground)', 'var(--warning)', 'var(--destructive)'];

interface BIAnalyticsViewProps {
    date?: DateRange;
}

export const BIAnalyticsView: React.FC<BIAnalyticsViewProps> = ({ date }) => {
    const [data, setData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const params: any = {};
                if (date?.to) params.end_date = format(date.to, 'yyyy-MM-dd');
                if (date?.from) params.start_date = format(date.from, 'yyyy-MM-dd');

                const res = await api.get('/finances/api/bi-analytics/', { params });
                setData(res.data);
            } catch (err) {
                console.error(err);
            } finally {
                setData(false);
            }
        };
        loadData();
    }, [date]);

    if (loading) return <div className="p-8 text-center animate-pulse">Cargando analytics...</div>;
    if (!data) return <div className="p-8 text-center text-muted-foreground">No hay datos disponibles</div>;

    const { sales, inventory, performance } = data;

    return (
        <div className={LAYOUT_TOKENS.view}>
            {/* KPI Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <IndustrialCard variant="industrial" className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-info">
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
                </IndustrialCard>

                <IndustrialCard variant="industrial" className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-success">
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
                </IndustrialCard>

                <IndustrialCard variant="industrial" className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-accent">
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
                </IndustrialCard>

                <IndustrialCard variant="industrial" className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-warning">
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
                </IndustrialCard>
            </div>

            {/* Sales Trend */}
            <IndustrialCard variant="industrial" className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800 border-t-4 border-t-primary">
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
                            <Tooltip formatter={(value: any) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Ventas']} />
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
            </IndustrialCard>

            {/* Two column layout for detailed insights */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Top Customers */}
                <IndustrialCard variant="industrial" className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800 border-t-4 border-t-blue-500">
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
                                <Tooltip formatter={(value: any) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Ventas']} />
                                <Bar dataKey="amount" fill={COLORS[1]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </IndustrialCard>

                {/* Inventory Distribution */}
                <IndustrialCard variant="industrial" className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800 border-t-4 border-t-accent">
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
                                    label={(entry: any) => `${entry.category}`}
                                    outerRadius={80}
                                    fill="var(--primary)"
                                    dataKey="value"
                                >
                                    {(inventory.stock_distribution || []).map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Valor']} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </IndustrialCard>
            </div>

            {/* Performance Insights Section */}
            <div className="grid gap-6 md:grid-cols-3">
                <IndustrialCard variant="industrial" className="shadow-md hover:shadow-lg transition-shadow">
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
                </IndustrialCard>

                <IndustrialCard variant="industrial" className="shadow-md hover:shadow-lg transition-shadow">
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
                </IndustrialCard>

                <IndustrialCard variant="industrial" className="shadow-md hover:shadow-lg transition-shadow">
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
                </IndustrialCard>

                <IndustrialCard variant="industrial" className="shadow-md hover:shadow-lg transition-shadow">
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
                </IndustrialCard>
            </div>
        </div>
    );
};
