"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ResponsiveLine } from '@nivo/line'
import { ResponsiveBar } from '@nivo/bar'
import { ResponsivePie } from '@nivo/pie'
import { financeApi } from "../api/financeApi";
import {TrendingUp, Package, DollarSign, ShoppingCart} from 'lucide-react';
import { CardSkeleton, EmptyState, MoneyDisplay, StatCard } from '@/components/shared';
;
import { formatCurrency } from "@/lib/money";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

import { PageContainer } from "@/components/shared"

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
            <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card">
                <CardHeader>
                    <CardTitle>Tendencia de Ventas</CardTitle>
                    <CardDescription>Evolución mensual de ventas</CardDescription>
                </CardHeader>
                <CardContent className="h-[350px]">
                    <ResponsiveLine
                        data={[
                            {
                                id: "Ventas Mensuales",
                                data: (sales.monthly_trend || []).map((d) => ({ x: d.month, y: d.sales })),
                            },
                        ]}
                        margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                        curve="monotoneX"
                        enableArea={false}
                        lineWidth={3}
                        pointSize={8}
                        pointBorderWidth={2}
                        enablePointLabel={false}
                        colors={{ scheme: "category10" }}
                        axisBottom={{
                            tickSize: 0,
                            tickPadding: 12,
                        }}
                        axisLeft={{
                            tickSize: 0,
                            tickPadding: 12,
                            format: (v) => formatCurrency(v),
                        }}
                        tooltip={({ point }) => (
                            <div className="rounded-lg border bg-background p-2 shadow-sm">
                                <p className="text-[10px] uppercase text-muted-foreground">
                                    {String(point.data.x)}
                                </p>
                                <p className="font-bold text-xs">
                                    Ventas: {formatCurrency(Number(point.data.y))}
                                </p>
                            </div>
                        )}
                        legends={[
                            {
                                anchor: "bottom",
                                direction: "row",
                                translateY: 50,
                                itemWidth: 130,
                                itemHeight: 20,
                                symbolSize: 12,
                                symbolShape: "circle",
                            },
                        ]}
                    />
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
                        <ResponsiveBar
                            data={sales.top_customers || []}
                            keys={["amount"]}
                            indexBy="name"
                            layout="horizontal"
                            padding={0.3}
                            colors={{ scheme: "set2" }}
                            borderRadius={4}
                            axisBottom={{
                                tickSize: 0,
                                tickPadding: 12,
                                format: (v) => formatCurrency(v),
                            }}
                            axisLeft={{
                                tickSize: 0,
                                tickPadding: 12,
                            }}
                            tooltip={({ value, indexValue }) => (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <p className="text-[10px] uppercase text-muted-foreground">{indexValue as string}</p>
                                    <p className="font-bold text-xs">Ventas: {formatCurrency(value)}</p>
                                </div>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Inventory Distribution */}
                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card">
                    <CardHeader>
                        <CardTitle>Distribución de Inventario</CardTitle>
                        <CardDescription>Por categoría de producto</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsivePie
                            data={(inventory.stock_distribution || []).map((d) => ({ id: d.category, value: d.value }))}
                            margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                            padAngle={2}
                            cornerRadius={4}
                            activeOuterRadiusOffset={8}
                            colors={{ scheme: "set3" }}
                            arcLinkLabel={(d) => d.id as string}
                            arcLinkLabelsColor={{ theme: "text" }}
                            arcLinkLabelsThickness={1}
                            arcLinkLabelsStraightLength={8}
                            arcLabelsSkipAngle={20}
                            tooltip={({ datum }) => (
                                <div className="rounded-lg border bg-background p-2 shadow-sm">
                                    <p className="text-[10px] uppercase text-muted-foreground">{datum.id}</p>
                                    <p className="font-bold text-xs">Valor: {formatCurrency(datum.value)}</p>
                                </div>
                            )}
                            legends={[
                                {
                                    anchor: "bottom",
                                    direction: "row",
                                    translateY: 50,
                                    itemWidth: 100,
                                    itemHeight: 18,
                                    symbolSize: 10,
                                    symbolShape: "circle",
                                },
                            ]}
                        />
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
                                <span className="font-semibold text-liability"><MoneyDisplay amount={performance.ap_total} /></span>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
    );
};
