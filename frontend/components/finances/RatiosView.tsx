"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    Tooltip,
    Legend,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    BarChart,
    Bar
} from 'recharts';
import api from '@/lib/api';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";

const COLORS = ['var(--primary)', 'var(--accent)', 'var(--secondary)', 'var(--muted-foreground)', 'var(--warning)', 'var(--destructive)'];

interface RatiosViewProps {
    date?: DateRange;
    showComparison?: boolean;
    compDate?: DateRange;
}

export const RatiosView: React.FC<RatiosViewProps> = ({ date, showComparison, compDate }) => {
    const [data, setData] = useState<any>(null);
    const [compData, setCompData] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const params: any = {};
                if (date?.to) {
                    params.end_date = format(date.to, 'yyyy-MM-dd');
                }
                if (date?.from) {
                    params.start_date = format(date.from, 'yyyy-MM-dd');
                }

                const res = await api.get('/finances/api/analysis/', { params });
                setData(res.data);

                // Load comparison data if enabled
                if (showComparison && compDate?.to) {
                    const compParams: any = {};
                    if (compDate.to) {
                        compParams.end_date = format(compDate.to, 'yyyy-MM-dd');
                    }
                    if (compDate.from) {
                        compParams.start_date = format(compDate.from, 'yyyy-MM-dd');
                    }
                    const compRes = await api.get('/finances/api/analysis/', { params: compParams });
                    setCompData(compRes.data);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [date, showComparison, compDate]);

    if (loading) return <div className="p-8 text-center animate-pulse">Cargando análisis financiero...</div>;
    if (!data) return <div className="p-8 text-center text-muted-foreground">No hay datos disponibles</div>;

    const structureData = [
        { name: 'Pasivos', value: data.structure.total_liabilities },
        { name: 'Patrimonio', value: data.structure.total_equity },
    ];

    const assetsDistribution = [
        { name: 'Corrientes', value: data.liquidity.current_assets },
        { name: 'No Corrientes', value: data.structure.total_assets - data.liquidity.current_assets },
    ];

    // Prepare trend data if comparison is enabled
    const trendData = showComparison && compData ? [
        {
            period: 'Anterior',
            liquidez: compData.liquidity.current_ratio,
            endeudamiento: compData.structure.debt_to_equity,
            solvencia: compData.solvency.solvency_ratio
        },
        {
            period: 'Actual',
            liquidez: data.liquidity.current_ratio,
            endeudamiento: data.structure.debt_to_equity,
            solvencia: data.solvency.solvency_ratio
        }
    ] : null;

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
            {/* Key Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-primary">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-primary/70">Ratio de Liquidez</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">{data.liquidity.current_ratio.toFixed(2)}</div>
                        {showComparison && compData && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                vs {compData.liquidity.current_ratio.toFixed(2)} ({((data.liquidity.current_ratio - compData.liquidity.current_ratio) / compData.liquidity.current_ratio * 100).toFixed(1)}%)
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Activo Corriente / Pasivo Corriente</p>
                    </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-amber-500">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-amber-600/70">Endeudamiento (D/E)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">{data.structure.debt_to_equity.toFixed(2)}</div>
                        {showComparison && compData && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                vs {compData.structure.debt_to_equity.toFixed(2)} ({((data.structure.debt_to_equity - compData.structure.debt_to_equity) / compData.structure.debt_to_equity * 100).toFixed(1)}%)
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Pasivos Totales / Patrimonio</p>
                    </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-indigo-500">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-indigo-600/70">Solvencia</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">{data.solvency.solvency_ratio.toFixed(2)}</div>
                        {showComparison && compData && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                vs {compData.solvency.solvency_ratio.toFixed(2)} ({((data.solvency.solvency_ratio - compData.solvency.solvency_ratio) / compData.solvency.solvency_ratio * 100).toFixed(1)}%)
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Activos Totales / Pasivos Totales</p>
                    </CardContent>
                </Card>

                <Card className="shadow-md hover:shadow-lg transition-shadow border-l-4 border-l-emerald-500">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-emerald-600/70">Capital de Trabajo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">
                            {(data.liquidity.current_assets - data.liquidity.current_liabilities).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Activo Corriente - Pasivo Corriente</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Debt Structure */}
                <Card className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800 border-t-4 border-t-emerald-500">
                    <CardHeader>
                        <CardTitle>Estructura de Financiamiento</CardTitle>
                        <CardDescription>Distribución entre Deuda y Patrimonio</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={structureData}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={(props: any) => `${props.name} (${(props.percent ? props.percent * 100 : 0).toFixed(0)}%)`}
                                    outerRadius={90}
                                    fill="var(--primary)"
                                    dataKey="value"
                                >
                                    {structureData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Monto']} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Assets Composition */}
                <Card className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800 border-t-4 border-t-blue-500">
                    <CardHeader>
                        <CardTitle>Composición de Activos</CardTitle>
                        <CardDescription>Corrientes vs No Corrientes</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={assetsDistribution}
                                    cx="50%"
                                    cy="50%"
                                    label={(props: any) => `${props.name} (${(props.percent ? props.percent * 100 : 0).toFixed(0)}%)`}
                                    innerRadius={60}
                                    outerRadius={90}
                                    fill="var(--accent)"
                                    dataKey="value"
                                >
                                    {assetsDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: any) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Monto']} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Ratios Trend - Only show if comparison enabled */}
                {showComparison && trendData && (
                    <Card className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800 md:col-span-2">
                        <CardHeader>
                            <CardTitle>Evolución de Ratios Financieros</CardTitle>
                            <CardDescription>Comparación período actual vs anterior</CardDescription>
                        </CardHeader>
                        <CardContent className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="period" />
                                    <YAxis />
                                    <Tooltip />
                                    <Legend />
                                    <Line type="monotone" dataKey="liquidez" stroke={COLORS[0]} strokeWidth={2} name="Ratio Liquidez" />
                                    <Line type="monotone" dataKey="endeudamiento" stroke={COLORS[1]} strokeWidth={2} name="D/E Ratio" />
                                    <Line type="monotone" dataKey="solvencia" stroke={COLORS[2]} strokeWidth={2} name="Solvencia" />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Working Capital Bar Chart */}
                <Card className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800 md:col-span-2">
                    <CardHeader>
                        <CardTitle>Análisis de Capital de Trabajo</CardTitle>
                        <CardDescription>Activos y Pasivos Corrientes</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: 'Activos Corrientes', value: data.liquidity.current_assets },
                                    { name: 'Pasivos Corrientes', value: data.liquidity.current_liabilities }
                                ]}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={(value: any) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Monto']} />
                                <Bar dataKey="value" fill={COLORS[3]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
