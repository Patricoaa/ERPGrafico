"use client"

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState, MoneyDisplay, PageContainer, PieChart, BarChart, LineChart, SkeletonShell, StatCard } from '@/components/shared'
import { formatMoney } from "@/lib/money"
import { useAnalysis } from "../hooks/useAnalysis";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
;

interface RatiosDashboardProps {
    date?: DateRange;
    showComparison?: boolean;
    compDate?: DateRange;
}

export const RatiosDashboard: React.FC<RatiosDashboardProps> = ({ date, showComparison, compDate }) => {
    const params: Record<string, unknown> = {
        is_async: true,
        ...(date?.to && { end_date: format(date.to, 'yyyy-MM-dd') }),
        ...(date?.from && { start_date: format(date.from, 'yyyy-MM-dd') }),
    }

    const compParams: Record<string, unknown> | undefined = showComparison ? {
        is_async: true,
        ...(compDate?.to && { end_date: format(compDate.to, 'yyyy-MM-dd') }),
        ...(compDate?.from && { start_date: format(compDate.from, 'yyyy-MM-dd') }),
    } : undefined

    const { data, isLoading, isError } = useAnalysis(params)
    const { data: compData } = useAnalysis(compParams)

    if (isError) return <EmptyState context="finance" variant="compact" title="Error al cargar ratios" description="No se pudieron cargar los indicadores financieros." />;
    if (!data && !isLoading) return <EmptyState context="finance" variant="compact" description="No hay datos disponibles para el período seleccionado" />;

    const PLACEHOLDER = { liquidity: { current_ratio: 0, acid_test: 0, current_assets: 0, current_liabilities: 0 }, structure: { debt_to_equity: 0, total_assets: 0, total_liabilities: 0, total_equity: 0 }, solvency: { solvency_ratio: 0 }, profitability: { gross_margin: 0, net_margin: 0 } } as const;
    const d = (data || PLACEHOLDER) as any;
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
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando ratios financieros">
            <PageContainer>
            {/* Key Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                <StatCard
                    label="Ratio de Liquidez"
                    value={d.liquidity.current_ratio.toFixed(2)}
                    valueSize="xl"
                    subtext="Activo Corriente / Pasivo Corriente"
                    accent="muted"
                >
                    {showComparison && cd && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            vs {cd.liquidity.current_ratio.toFixed(2)} ({((d.liquidity.current_ratio - cd.liquidity.current_ratio) / cd.liquidity.current_ratio * 100).toFixed(1)}%)
                        </div>
                    )}
                </StatCard>
                <StatCard
                    label="Endeudamiento (D/E)"
                    value={d.structure.debt_to_equity.toFixed(2)}
                    valueSize="xl"
                    subtext="Pasivos Totales / Patrimonio"
                    accent="warning"
                >
                    {showComparison && cd && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            vs {cd.structure.debt_to_equity.toFixed(2)} ({((d.structure.debt_to_equity - cd.structure.debt_to_equity) / cd.structure.debt_to_equity * 100).toFixed(1)}%)
                        </div>
                    )}
                </StatCard>
                <StatCard
                    label="Solvencia"
                    value={d.solvency.solvency_ratio.toFixed(2)}
                    valueSize="xl"
                    subtext="Activos Totales / Pasivos Totales"
                    accent="info"
                >
                    {showComparison && cd && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            vs {cd.solvency.solvency_ratio.toFixed(2)} ({((d.solvency.solvency_ratio - cd.solvency.solvency_ratio) / cd.solvency.solvency_ratio * 100).toFixed(1)}%)
                        </div>
                    )}
                </StatCard>
                <StatCard
                    label="Capital de Trabajo"
                    value={<MoneyDisplay amount={d.liquidity.current_assets - d.liquidity.current_liabilities} />}
                    valueSize="xl"
                    subtext="Activo Corriente - Pasivo Corriente"
                    accent="success"
                />
                <StatCard
                    label="Prueba Ácida"
                    value={(d.liquidity.acid_test || 0).toFixed(2)}
                    valueSize="xl"
                    subtext="(Activo Cte. - Inventario) / Pasivo Cte."
                    accent="primary"
                >
                    {showComparison && cd && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            vs {(cd.liquidity.acid_test || 0).toFixed(2)} ({cd.liquidity.acid_test ? (((d.liquidity.acid_test - cd.liquidity.acid_test) / cd.liquidity.acid_test) * 100).toFixed(1) : 0}%)
                        </div>
                    )}
                </StatCard>
                <StatCard
                    label="Margen Bruto"
                    value={`${((d.profitability?.gross_margin || 0) * 100).toFixed(1)}%`}
                    valueSize="xl"
                    subtext="Utilidad Bruta / Ingresos Operac."
                    accent="accent"
                >
                    {showComparison && cd && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            vs {((cd.profitability?.gross_margin || 0) * 100).toFixed(1)}%
                        </div>
                    )}
                </StatCard>
                <StatCard
                    label="Margen Neto"
                    value={`${((d.profitability?.net_margin || 0) * 100).toFixed(1)}%`}
                    valueSize="xl"
                    subtext="Utilidad Neta / Ingresos Operac."
                    accent="info"
                >
                    {showComparison && cd && (
                        <div className="mt-2 text-xs text-muted-foreground">
                            vs {((cd.profitability?.net_margin || 0) * 100).toFixed(1)}%
                        </div>
                    )}
                </StatCard>
            </div>

            {/* Charts Section */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Debt Structure */}
                <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card border-t-success ring-0">
                    <CardHeader>
                        <CardTitle>Estructura de Financiamiento</CardTitle>
                        <CardDescription>Distribución entre Deuda y Patrimonio</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <PieChart
                            data={structureData}
                            legends={[
                                {
                                    anchor: "bottom",
                                    direction: "row",
                                    translateY: 50,
                                    itemWidth: 120,
                                    itemHeight: 18,
                                    symbolSize: 10,
                                    symbolShape: "circle",
                                },
                            ]}
                            renderTooltip={({ id, value }) => (
                                <>
                                    <span className="font-medium">{String(id)}</span>
                                    <span className="ml-2 font-bold">{formatMoney(value)}</span>
                                </>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Assets Composition */}
                <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card border-t-info ring-0">
                    <CardHeader>
                        <CardTitle>Composición de Activos</CardTitle>
                        <CardDescription>Corrientes vs No Corrientes</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <PieChart
                            data={assetsDistribution}
                            legends={[
                                {
                                    anchor: "bottom",
                                    direction: "row",
                                    translateY: 50,
                                    itemWidth: 120,
                                    itemHeight: 18,
                                    symbolSize: 10,
                                    symbolShape: "circle",
                                },
                            ]}
                            renderTooltip={({ id, value }) => (
                                <>
                                    <span className="font-medium">{String(id)}</span>
                                    <span className="ml-2 font-bold">{formatMoney(value)}</span>
                                </>
                            )}
                        />
                    </CardContent>
                </Card>

                {/* Ratios Trend - Only show if comparison enabled */}
                {showComparison && trendData && (() => {
                    const lineKeys = [
                        { key: 'liquidez', label: 'Ratio Liquidez' },
                        { key: 'endeudamiento', label: 'D/E Ratio' },
                        { key: 'solvencia', label: 'Solvencia' },
                        { key: 'mrgn_bruto', label: 'Margen Bruto (%)' },
                        { key: 'mrgn_neto', label: 'Margen Neto (%)' },
                    ]
                    const lineChartData = lineKeys.map(({ key, label }) => ({
                        id: label,
                        data: trendData.map((d) => ({ x: d.period, y: d[key as keyof typeof d] as number })),
                    }))
                    return (
                        <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card md:col-span-2 border-t-primary/50 ring-0">
                            <CardHeader>
                                <CardTitle>Evolución de Ratios Financieros</CardTitle>
                                <CardDescription>Comparación período actual vs anterior</CardDescription>
                            </CardHeader>
                            <CardContent className="h-[300px]">
                                <LineChart
                                    data={lineChartData}
                                    margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                                    enableArea={false}
                                    colors={{ scheme: "category10" }}
                                    axisBottom={{
                                        tickSize: 0,
                                        tickPadding: 12,
                                    }}
                                    axisLeft={{
                                        tickSize: 0,
                                        tickPadding: 12,
                                    }}
                                    renderTooltip={({ serieId, data: pointData }) => (
                                        <>
                                            <span className="font-medium">{String(pointData.x)}</span>
                                            <span className="ml-2 font-bold">{String(serieId)}: {Number(pointData.y).toFixed(2)}</span>
                                        </>
                                    )}
                                    legends={[
                                        {
                                            anchor: "bottom",
                                            direction: "row",
                                            translateY: 50,
                                            itemWidth: 120,
                                            itemHeight: 20,
                                            symbolSize: 10,
                                            symbolShape: "circle",
                                        },
                                    ]}
                                />
                            </CardContent>
                        </Card>
                    )
                })()}

                {/* Working Capital Bar Chart */}
                <Card className="rounded-none shadow-elevated ring-1 ring-border bg-card md:col-span-2 border-t-muted ring-0">
                    <CardHeader>
                        <CardTitle>Análisis de Capital de Trabajo</CardTitle>
                        <CardDescription>Activos y Pasivos Corrientes</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <BarChart
                            data={[
                                { name: 'Activos Corrientes', value: d.liquidity.current_assets },
                                { name: 'Pasivos Corrientes', value: d.liquidity.current_liabilities },
                            ]}
                            keys={["value"]}
                            indexBy="name"
                            colors={{ scheme: "set2" }}
                            enableGridY
                            axisBottom={{
                                tickSize: 0,
                                tickPadding: 12,
                            }}
                            axisLeft={{
                                tickSize: 0,
                                tickPadding: 12,
                                                format: (v: number) => formatMoney(v),
                            }}
                            renderTooltip={({ value, indexValue }) => (
                                <>
                                    <span className="font-medium">{String(indexValue)}</span>
                                    <span className="ml-2 font-bold">{formatMoney(value)}</span>
                                </>
                            )}
                        />
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
        </SkeletonShell>
    );
};
