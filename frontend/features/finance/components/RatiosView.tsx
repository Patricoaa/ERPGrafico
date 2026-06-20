"use client"

import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { EmptyState, MoneyDisplay, PageContainer, ChartTooltip } from '@/components/shared'
import { formatMoney } from "@/lib/money"
import { ResponsivePie } from '@nivo/pie'
import { ResponsiveLine } from '@nivo/line'
import { ResponsiveBar } from '@nivo/bar'
import { useAnalysis } from "../hooks/useAnalysis";
import { DateRange } from "react-day-picker";
import { format } from "date-fns";
import { SkeletonShell, StatCard } from "@/components/shared";
;

interface RatiosViewProps {
    date?: DateRange;
    showComparison?: boolean;
    compDate?: DateRange;
}

export const RatiosView: React.FC<RatiosViewProps> = ({ date, showComparison, compDate }) => {
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
                        <ResponsivePie
                            data={structureData.map((d) => ({ id: d.name, value: d.value }))}
                            margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                            padAngle={2}
                            cornerRadius={4}
                            activeOuterRadiusOffset={8}
                            colors={{ scheme: "set2" }}
                            arcLinkLabel={(d) => `${d.id} (${((d.value / structureData.reduce((s, v) => s + v.value, 0)) * 100).toFixed(0)}%)`}
                            arcLinkLabelsColor={{ theme: "text" }}
                            arcLinkLabelsThickness={1}
                            arcLinkLabelsStraightLength={8}
                            arcLabelsSkipAngle={20}
                            tooltip={({ datum }) => (
                                <ChartTooltip>
                                    <p className="text-[10px] uppercase text-muted-foreground">{datum.id}</p>
                                    <p className="font-bold text-xs">Monto: {formatMoney(datum.value)}</p>
                                </ChartTooltip>
                            )}
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
                        <ResponsivePie
                            data={assetsDistribution.map((d) => ({ id: d.name, value: d.value }))}
                            margin={{ top: 20, right: 20, bottom: 40, left: 20 }}
                            innerRadius={0.6}
                            padAngle={2}
                            cornerRadius={4}
                            activeOuterRadiusOffset={8}
                            colors={{ scheme: "set3" }}
                            arcLinkLabel={(d) => `${d.id} (${((d.value / assetsDistribution.reduce((s, v) => s + v.value, 0)) * 100).toFixed(0)}%)`}
                            arcLinkLabelsColor={{ theme: "text" }}
                            arcLinkLabelsThickness={1}
                            arcLinkLabelsStraightLength={8}
                            arcLabelsSkipAngle={20}
                            tooltip={({ datum }) => (
                                <ChartTooltip>
                                    <p className="text-[10px] uppercase text-muted-foreground">{datum.id}</p>
                                    <p className="font-bold text-xs">Monto: {formatMoney(datum.value)}</p>
                                </ChartTooltip>
                            )}
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
                                <ResponsiveLine
                                    data={lineChartData}
                                    margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                                    curve="monotoneX"
                                    lineWidth={2}
                                    pointSize={6}
                                    enablePointLabel={false}
                                    colors={{ scheme: "category10" }}
                                    axisBottom={{
                                        tickSize: 0,
                                        tickPadding: 12,
                                    }}
                                    axisLeft={{
                                        tickSize: 0,
                                        tickPadding: 12,
                                    }}
                                    tooltip={({ point }) => (
                                        <ChartTooltip>
                                            <p className="text-[10px] uppercase text-muted-foreground">{String(point.data.x)}</p>
                                            <p className="text-xs font-bold">{String(point.seriesId)}: {Number(point.data.y).toFixed(2)}</p>
                                        </ChartTooltip>
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
                        <ResponsiveBar
                            data={[
                                { name: 'Activos Corrientes', value: d.liquidity.current_assets },
                                { name: 'Pasivos Corrientes', value: d.liquidity.current_liabilities },
                            ]}
                            keys={["value"]}
                            indexBy="name"
                            padding={0.3}
                            colors={{ scheme: "set2" }}
                            borderRadius={4}
                            axisBottom={{
                                tickSize: 0,
                                tickPadding: 12,
                            }}
                            axisLeft={{
                                tickSize: 0,
                                tickPadding: 12,
                                format: (v) => formatMoney(v as number),
                            }}
                            tooltip={({ value, indexValue }) => (
                                <ChartTooltip>
                                    <p className="text-[10px] uppercase text-muted-foreground">{indexValue as string}</p>
                                    <p className="font-bold text-xs">Monto: {formatMoney(value)}</p>
                                </ChartTooltip>
                            )}
                        />
                    </CardContent>
                </Card>
            </div>
        </PageContainer>
        </SkeletonShell>
    );
};
