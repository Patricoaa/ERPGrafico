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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#FF6B9D'];

interface BIAnalyticsViewProps {
    date?: DateRange;
}

export const BIAnalyticsView: React.FC<BIAnalyticsViewProps> = ({ date }) => {
    const [salesData, setSalesData] = useState<any>(null);
    const [inventoryData, setInventoryData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                // For now, we'll mock some data since we may not have all backend endpoints
                // In production, these would be real API calls

                // Mock sales data
                setSalesData({
                    total_sales: 15000000,
                    sales_count: 45,
                    average_ticket: 333333,
                    growth: 12.5,
                    monthly_trend: [
                        { month: 'Ene', sales: 1200000 },
                        { month: 'Feb', sales: 1400000 },
                        { month: 'Mar', sales: 1600000 },
                        { month: 'Abr', sales: 1500000 },
                        { month: 'May', sales: 1800000 },
                        { month: 'Jun', sales: 2000000 }
                    ],
                    top_customers: [
                        { name: 'Cliente A', amount: 3500000 },
                        { name: 'Cliente B', amount: 2800000 },
                        { name: 'Cliente C', amount: 2200000 },
                        { name: 'Cliente D', amount: 1900000 },
                        { name: 'Cliente E', amount: 1500000 }
                    ]
                });

                setInventoryData({
                    total_value: 8500000,
                    item_count: 234,
                    turnover_ratio: 4.2,
                    stock_distribution: [
                        { category: 'Materia Prima', value: 3400000, items: 85 },
                        { category: 'Productos Terminados', value: 3100000, items: 92 },
                        { category: 'Insumos', value: 2000000, items: 57 }
                    ],
                    low_stock_alerts: 12
                });
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [date]);

    if (loading) return <div className="p-8 text-center animate-pulse">Cargando analytics...</div>;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
            {/* KPI Overview Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-blue-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ventas Totales</CardTitle>
                        <DollarSign className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {salesData?.total_sales.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                        </div>
                        <div className="flex items-center text-xs text-emerald-600 mt-1">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            +{salesData?.growth}% vs período anterior
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-green-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                        <ShoppingCart className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {salesData?.average_ticket.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {salesData?.sales_count} ventas realizadas
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-purple-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Valor Inventario</CardTitle>
                        <Package className="h-4 w-4 text-purple-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {inventoryData?.total_value.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {inventoryData?.item_count} productos en stock
                        </p>
                    </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-orange-500">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Rotación Inventario</CardTitle>
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{inventoryData?.turnover_ratio}x</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {inventoryData?.low_stock_alerts} alertas de stock bajo
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Sales Trend */}
            <Card className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800">
                <CardHeader>
                    <CardTitle>Tendencia de Ventas</CardTitle>
                    <CardDescription>Evolución mensual de ventas</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salesData?.monthly_trend || []}>
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
            </Card>

            {/* Two column layout for detailed insights */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Top Customers */}
                <Card className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800">
                    <CardHeader>
                        <CardTitle>Top 5 Clientes</CardTitle>
                        <CardDescription>Por volumen de ventas</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={salesData?.top_customers || []} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={100} />
                                <Tooltip formatter={(value: any) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Ventas']} />
                                <Bar dataKey="amount" fill={COLORS[1]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Inventory Distribution */}
                <Card className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800">
                    <CardHeader>
                        <CardTitle>Distribución de Inventario</CardTitle>
                        <CardDescription>Por categoría de producto</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={inventoryData?.stock_distribution || []}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={(entry: any) => `${entry.category} (${entry.items})`}
                                    outerRadius={80}
                                    fill="#8884d8"
                                    dataKey="value"
                                >
                                    {(inventoryData?.stock_distribution || []).map((entry: any, index: number) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Valor']} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Additional Insights Section */}
            <div className="grid gap-6 md:grid-cols-3">
                <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Análisis de Compras</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Total Compras:</span>
                                <span className="font-semibold">$12.5M</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Órdenes Abiertas:</span>
                                <span className="font-semibold">8</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Proveedores Activos:</span>
                                <span className="font-semibold">23</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Eficiencia Producción</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Órdenes Completadas:</span>
                                <span className="font-semibold">34</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">En Proceso:</span>
                                <span className="font-semibold">12</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Eficiencia:</span>
                                <span className="font-semibold text-emerald-600">94%</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow">
                    <CardHeader>
                        <CardTitle className="text-base">Cuentas por Cobrar</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Total Pendiente:</span>
                                <span className="font-semibold">$8.2M</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Vencidas:</span>
                                <span className="font-semibold text-red-600">$1.3M</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Días Promedio:</span>
                                <span className="font-semibold">42</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
