"use client"

import React from 'react';
import { EmptyState, MoneyDisplay, PieChart, BarChart, LineChart, SkeletonShell, StatCard } from '@/components/shared'
import { formatMoney } from "@/lib/money"
import { useAnalysis } from "../hooks/useAnalysis";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";

interface AnalysisData {
    liquidity: {
        current_ratio: number
        acid_test: number
        current_assets: number
        current_liabilities: number
    }
    structure: {
        debt_to_equity: number
        total_assets: number
        total_liabilities: number
        total_equity: number
    }
    solvency: {
        solvency_ratio: number
    }
    profitability?: {
        gross_margin: number
        net_margin: number
    }
}

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

    const PLACEHOLDER: AnalysisData = { liquidity: { current_ratio: 0, acid_test: 0, current_assets: 0, current_liabilities: 0 }, structure: { debt_to_equity: 0, total_assets: 0, total_liabilities: 0, total_equity: 0 }, solvency: { solvency_ratio: 0 }, profitability: { gross_margin: 0, net_margin: 0 } };
    const d = (data || PLACEHOLDER) as AnalysisData;
    const cd = compData as AnalysisData | undefined;

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
                <div className="flex flex-col">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Estructura de Financiamiento</h3>
                    <span className="text-[10px] text-muted-foreground/70 mb-3">Distribución entre Deuda y Patrimonio</span>
                    <div className="h-[300px]">
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
                        />
                    </div>
                </div>

                {/* Assets Composition */}
                <div className="flex flex-col">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Composición de Activos</h3>
                    <span className="text-[10px] text-muted-foreground/70 mb-3">Corrientes vs No Corrientes</span>
                    <div className="h-[300px]">
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
                        />
                    </div>
                </div>

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
                        <div className="flex flex-col md:col-span-2">
                            <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Evolución de Ratios Financieros</h3>
                            <span className="text-[10px] text-muted-foreground/70 mb-3">Comparación período actual vs anterior</span>
                            <div className="h-[300px]">
                                <LineChart
                                    data={lineChartData}
                                    margin={{ top: 20, right: 20, bottom: 50, left: 60 }}
                                    axisBottom={{
                                        tickSize: 0,
                                        tickPadding: 12,
                                    }}
                                    axisLeft={{
                                        tickSize: 0,
                                        tickPadding: 12,
                                    }}
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
                            </div>
                        </div>
                    )
                })()}

                {/* Working Capital Bar Chart */}
                <div className="flex flex-col md:col-span-2">
                    <h3 className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Análisis de Capital de Trabajo</h3>
                    <span className="text-[10px] text-muted-foreground/70 mb-3">Activos y Pasivos Corrientes</span>
                    <div className="h-[300px]">
                        <BarChart
                            data={[
                                { name: 'Activos Corrientes', value: d.liquidity.current_assets },
                                { name: 'Pasivos Corrientes', value: d.liquidity.current_liabilities },
                            ]}
                            keys={["value"]}
                            indexBy="name"
                            axisBottom={{
                                tickSize: 0,
                                tickPadding: 12,
                            }}
                            axisLeft={{
                                tickSize: 0,
                                tickPadding: 12,
                                                format: (v: number) => formatMoney(v),
                            }}
                        />
                    </div>
                </div>
            </div>
        </SkeletonShell>
    );
};
