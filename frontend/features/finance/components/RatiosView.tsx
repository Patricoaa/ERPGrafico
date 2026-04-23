"use client"

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LAYOUT_TOKENS } from "@/lib/styles";
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
import api, { pollTask } from '@/lib/api';
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { LoadingFallback } from "@/components/shared/LoadingFallback";
import { EmptyState } from "@/components/shared/EmptyState";

const COLORS = ['var(--primary)', 'var(--accent)', 'var(--secondary)', 'var(--muted-foreground)', 'var(--warning)', 'var(--destructive)'];

interface RatiosViewProps {
    date?: DateRange;
    showComparison?: boolean;
    compDate?: DateRange;
}

export const RatiosView: React.FC<RatiosViewProps> = ({ date, showComparison, compDate }) => {
    const [data, setData] = useState<Record<string, unknown> | null>(null);
    const [compData, setCompData] = useState<Record<string, unknown> | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            setLoading(true);
            try {
                const params: Record<string, unknown> = { is_async: true };
                if (date?.to) {
                    params.end_date = format(date.to, 'yyyy-MM-dd');
                }
                if (date?.from) {
                    params.start_date = format(date.from, 'yyyy-MM-dd');
                }

                const res = await api.get('finances/api/analysis/', { params });
                const finalData = res.data.task_id ? await pollTask(res.data.task_id) : res.data;
                setData(finalData);

                // Load comparison data if enabled
                if (showComparison && compDate?.to) {
                    const compParams: Record<string, unknown> = { is_async: true };
                    if (compDate.to) {
                        compParams.end_date = format(compDate.to, 'yyyy-MM-dd');
                    }
                    if (compDate.from) {
                        compParams.start_date = format(compDate.from, 'yyyy-MM-dd');
                    }
                    const compRes = await api.get('finances/api/analysis/', { params: compParams });
                    const finalCompData = compRes.data.task_id ? await pollTask(compRes.data.task_id) : compRes.data;
                    setCompData(finalCompData);
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [date, showComparison, compDate]);

    if (loading) return <LoadingFallback message="Cargando análisis financiero..." />;
    if (!data) return <EmptyState context="finance" variant="compact" description="No hay datos disponibles para el período seleccionado" />;

    const d = data as any;
    const cd = compData as any;

    const structureData = [
        { name: 'Pasivos', value: d.structure.total_liabilities },
        { name: 'Patrimonio', value: d.structure.total_equity },
    ];

    const assetsDistribution = [
        { name: 'Corrientes', value: d.liquidity.current_assets },
        { name: 'No Corrientes', value: d.structure.total_assets - d.liquidity.current_assets },
    ];

    // Prepare trend data if comparison is enabled
    const trendData = showComparison && cd ? [
        {
            period: 'Anterior',
            liquidez: cd.liquidity.current_ratio,
            endeudamiento: cd.structure.debt_to_equity,
            solvencia: cd.solvency.solvency_ratio,
            mrgn_bruto: (cd.profitability?.gross_margin || 0) * 100,
            mrgn_neto: (cd.profitability?.net_margin || 0) * 100
        },
        {
            period: 'Actual',
            liquidez: d.liquidity.current_ratio,
            endeudamiento: d.structure.debt_to_equity,
            solvencia: d.solvency.solvency_ratio,
            mrgn_bruto: (d.profitability?.gross_margin || 0) * 100,
            mrgn_neto: (d.profitability?.net_margin || 0) * 100
        }
    ] : null;

    return (
        <div className={LAYOUT_TOKENS.view}>
            {/* Key Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-primary/70">Ratio de Liquidez</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">{d.liquidity.current_ratio.toFixed(2)}</div>
                        {showComparison && cd && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                vs {cd.liquidity.current_ratio.toFixed(2)} ({((d.liquidity.current_ratio - cd.liquidity.current_ratio) / cd.liquidity.current_ratio * 100).toFixed(1)}%)
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Activo Corriente / Pasivo Corriente</p>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-t-warning">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-warning/70">Endeudamiento (D/E)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">{d.structure.debt_to_equity.toFixed(2)}</div>
                        {showComparison && cd && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                vs {cd.structure.debt_to_equity.toFixed(2)} ({((d.structure.debt_to_equity - cd.structure.debt_to_equity) / cd.structure.debt_to_equity * 100).toFixed(1)}%)
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Pasivos Totales / Patrimonio</p>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-t-info">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-primary/70">Solvencia</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">{d.solvency.solvency_ratio.toFixed(2)}</div>
                        {showComparison && cd && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                vs {cd.solvency.solvency_ratio.toFixed(2)} ({((d.solvency.solvency_ratio - cd.solvency.solvency_ratio) / cd.solvency.solvency_ratio * 100).toFixed(1)}%)
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Activos Totales / Pasivos Totales</p>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-t-success">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-success/70">Capital de Trabajo</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">
                            {(d.liquidity.current_assets - d.liquidity.current_liabilities).toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
                        </div>
                        <p className="text-xs text-muted-foreground mt-2">Activo Corriente - Pasivo Corriente</p>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-t-primary">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-primary/70">Prueba Ácida</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-primary">{(d.liquidity.acid_test || 0).toFixed(2)}</div>
                        {showComparison && cd && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                vs {(cd.liquidity.acid_test || 0).toFixed(2)} ({cd.liquidity.acid_test ? (((d.liquidity.acid_test - cd.liquidity.acid_test) / cd.liquidity.acid_test) * 100).toFixed(1) : 0}%)
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">(Activo Cte. - Inventario) / Pasivo Cte.</p>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-t-accent">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-accent/70">Margen Bruto</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-accent">{((d.profitability?.gross_margin || 0) * 100).toFixed(1)}%</div>
                        {showComparison && cd && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                vs {((cd.profitability?.gross_margin || 0) * 100).toFixed(1)}%
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Utilidad Bruta / Ingresos Operac.</p>
                    </CardContent>
                </Card>

                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-t-info">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-muted-foreground text-info/70">Margen Neto</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-info">{((d.profitability?.net_margin || 0) * 100).toFixed(1)}%</div>
                        {showComparison && cd && (
                            <div className="mt-2 text-xs text-muted-foreground">
                                vs {((cd.profitability?.net_margin || 0) * 100).toFixed(1)}%
                            </div>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">Utilidad Neta / Ingresos Operac.</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Debt Structure */}
                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-t-success ring-0 shadow-xl">
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
                                    label={((props: { name: string; percent?: number }) => `${props.name} (${(props.percent ? props.percent * 100 : 0).toFixed(0)}%)`) as any}
                                    outerRadius={90}
                                    fill="var(--primary)"
                                    dataKey="value"
                                >
                                    {structureData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={((value: number | string) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Monto']) as any} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Assets Composition */}
                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card border-t-info ring-0 shadow-xl">
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
                                    label={((props: { name: string; percent?: number }) => `${props.name} (${(props.percent ? props.percent * 100 : 0).toFixed(0)}%)`) as any}
                                    innerRadius={60}
                                    outerRadius={90}
                                    fill="var(--accent)"
                                    dataKey="value"
                                >
                                    {assetsDistribution.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={((value: number | string) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Monto']) as any} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Ratios Trend - Only show if comparison enabled */}
                {showComparison && trendData && (
                    <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card md:col-span-2 border-t-primary/50 ring-0 shadow-xl">
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
                                    <Line type="monotone" dataKey="mrgn_bruto" stroke={COLORS[3]} strokeWidth={2} name="Margen Bruto (%)" />
                                    <Line type="monotone" dataKey="mrgn_neto" stroke={COLORS[4]} strokeWidth={2} name="Margen Neto (%)" />
                                </LineChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>
                )}

                {/* Working Capital Bar Chart */}
                <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card md:col-span-2 border-t-muted ring-0 shadow-xl">
                    <CardHeader>
                        <CardTitle>Análisis de Capital de Trabajo</CardTitle>
                        <CardDescription>Activos y Pasivos Corrientes</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={[
                                    { name: 'Activos Corrientes', value: d.liquidity.current_assets },
                                    { name: 'Pasivos Corrientes', value: d.liquidity.current_liabilities }
                                ]}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="name" />
                                <YAxis />
                                <Tooltip formatter={((value: number | string) => [Number(value || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' }), 'Monto']) as any} />
                                <Bar dataKey="value" fill={COLORS[3]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
