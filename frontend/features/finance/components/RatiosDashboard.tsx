"use client"

import React from 'react';
import { EmptyState, MoneyDisplay, PieChart, BarChart, LineChart, RadarChart, SkeletonShell, StatCard, StaleDataBanner, KPIWrapper, KPIValue, DeltaBadge, SectionCard, ChartLegend } from '@/components/shared'
import { formatMoney } from "@/lib/money"
import { useAnalysis } from "../hooks/useAnalysis";
import { type DateRange } from "react-day-picker";
import { format } from "date-fns";
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'


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
        operating_margin?: number
        net_margin: number
        total_revenue?: number
        gross_profit?: number
        operating_profit?: number
        net_income?: number
    }
}

interface RatiosDashboardProps {
    date?: DateRange;
    showComparison?: boolean;
    compDate?: DateRange;
}

// Returns a health signal for a financial ratio
function getRatioHealth(key: string, value: number): { color: string; label: string; icon: React.ReactNode } {
    const checks: Record<string, { ok: (v: number) => boolean; warn: (v: number) => boolean; okLabel: string; warnLabel: string; badLabel: string }> = {
        current_ratio: { ok: v => v >= 1.5, warn: v => v >= 1, okLabel: 'Saludable', warnLabel: 'Aceptable', badLabel: 'Crítico' },
        acid_test:     { ok: v => v >= 1,   warn: v => v >= 0.5, okLabel: 'Saludable', warnLabel: 'Aceptable', badLabel: 'Riesgo' },
        debt_to_equity:{ ok: v => v <= 1,   warn: v => v <= 2,   okLabel: 'Conservador', warnLabel: 'Moderado', badLabel: 'Alto' },
        solvency_ratio:{ ok: v => v >= 2,   warn: v => v >= 1.5, okLabel: 'Sólido', warnLabel: 'Aceptable', badLabel: 'Insolvente' },
        gross_margin:  { ok: v => v >= 0.3, warn: v => v >= 0.1, okLabel: 'Excelente', warnLabel: 'Moderado', badLabel: 'Bajo' },
        net_margin:    { ok: v => v >= 0.1, warn: v => v >= 0.03, okLabel: 'Excelente', warnLabel: 'Moderado', badLabel: 'Bajo' },
    }
    const c = checks[key]
    if (!c) return { color: 'text-muted-foreground', label: '', icon: <Minus className="h-3 w-3" /> }
    if (c.ok(value)) return { color: 'text-success', label: c.okLabel, icon: <TrendingUp className="h-3 w-3" /> }
    if (c.warn(value)) return { color: 'text-warning', label: c.warnLabel, icon: <Minus className="h-3 w-3" /> }
    return { color: 'text-destructive', label: c.badLabel, icon: <TrendingDown className="h-3 w-3" /> }
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

    if (!data && !isLoading) return <EmptyState context="finance" variant="compact" description="No hay datos disponibles para el período seleccionado" />;

    const PLACEHOLDER: AnalysisData = { liquidity: { current_ratio: 0, acid_test: 0, current_assets: 0, current_liabilities: 0 }, structure: { debt_to_equity: 0, total_assets: 0, total_liabilities: 0, total_equity: 0 }, solvency: { solvency_ratio: 0 }, profitability: { gross_margin: 0, operating_margin: 0, net_margin: 0 } };
    const d = (data || PLACEHOLDER) as AnalysisData;
    const cd = compData as AnalysisData | undefined;

    // Pie: Debt vs Equity structure
    const structureData = [
        { name: 'Pasivos', value: Math.max(d.structure.total_liabilities, 0) },
        { name: 'Patrimonio', value: Math.max(d.structure.total_equity, 0) },
    ].filter(x => x.value > 0);

    const structureDataComp = cd ? [
        { name: 'Pasivos', value: Math.max(cd.structure.total_liabilities, 0) },
        { name: 'Patrimonio', value: Math.max(cd.structure.total_equity, 0) },
    ].filter(x => x.value > 0) : [];

    // Pie: Current vs Non-current assets
    const nonCurrent = Math.max(d.structure.total_assets - d.liquidity.current_assets, 0)
    const assetsDistribution = [
        { name: 'Corrientes', value: Math.max(d.liquidity.current_assets, 0) },
        { name: 'No Corrientes', value: nonCurrent },
    ].filter(x => x.value > 0);

    const nonCurrentComp = cd ? Math.max(cd.structure.total_assets - cd.liquidity.current_assets, 0) : 0;
    const assetsDistributionComp = cd ? [
        { name: 'Corrientes', value: Math.max(cd.liquidity.current_assets, 0) },
        { name: 'No Corrientes', value: nonCurrentComp },
    ].filter(x => x.value > 0) : [];

    // Radar chart: normalized financial health overview (scale 0-100)
    const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)
    const radarData = [
        {
            indicador: 'Liquidez',
            Actual: Math.round(clamp(d.liquidity.current_ratio / 3, 0, 1) * 100),
            ...(cd ? { Anterior: Math.round(clamp(cd.liquidity.current_ratio / 3, 0, 1) * 100) } : {}),
        },
        {
            indicador: 'Prueba Ácida',
            Actual: Math.round(clamp(d.liquidity.acid_test / 2, 0, 1) * 100),
            ...(cd ? { Anterior: Math.round(clamp(cd.liquidity.acid_test / 2, 0, 1) * 100) } : {}),
        },
        {
            indicador: 'Solvencia',
            Actual: Math.round(clamp((d.solvency.solvency_ratio - 1) / 4, 0, 1) * 100),
            ...(cd ? { Anterior: Math.round(clamp((cd.solvency.solvency_ratio - 1) / 4, 0, 1) * 100) } : {}),
        },
        {
            indicador: 'Margen Bruto',
            Actual: Math.round(clamp((d.profitability?.gross_margin || 0) / 0.5, 0, 1) * 100),
            ...(cd ? { Anterior: Math.round(clamp((cd.profitability?.gross_margin || 0) / 0.5, 0, 1) * 100) } : {}),
        },
        {
            indicador: 'Margen Neto',
            Actual: Math.round(clamp((d.profitability?.net_margin || 0) / 0.2, 0, 1) * 100),
            ...(cd ? { Anterior: Math.round(clamp((cd.profitability?.net_margin || 0) / 0.2, 0, 1) * 100) } : {}),
        },
        {
            indicador: 'Endeudamiento',
            // Inverted: lower D/E is better. Score = 1 - capped ratio/3
            Actual: Math.round(clamp(1 - d.structure.debt_to_equity / 3, 0, 1) * 100),
            ...(cd ? { Anterior: Math.round(clamp(1 - cd.structure.debt_to_equity / 3, 0, 1) * 100) } : {}),
        },
    ]
    const radarKeys = showComparison && cd ? ['Actual', 'Anterior'] : ['Actual']

    // Bar chart: Working capital
    const workingCapitalData = showComparison && cd ? [
        { name: 'Activos Ctes.', 'Actual': d.liquidity.current_assets, 'Anterior': cd.liquidity.current_assets },
        { name: 'Pasivos Ctes.', 'Actual': d.liquidity.current_liabilities, 'Anterior': cd.liquidity.current_liabilities },
    ] : [
        { name: 'Activos Ctes.', 'Actual': d.liquidity.current_assets },
        { name: 'Pasivos Ctes.', 'Actual': d.liquidity.current_liabilities },
    ]
    const barKeys = showComparison && cd ? ["Actual", "Anterior"] : ["Actual"]

    return (
        <SkeletonShell isLoading={isLoading} ariaLabel="Cargando ratios financieros">
            {isError && <StaleDataBanner className="mx-4 mt-2" />}

            {/* ── Row 1: KPI Cards ── */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                {/* Liquidez */}
                {(() => {
                    const health = getRatioHealth('current_ratio', d.liquidity.current_ratio)
                    return (
                        <KPIWrapper tooltip="Mide la capacidad de la empresa para pagar sus deudas a corto plazo con sus activos más líquidos (Activo Corriente / Pasivo Corriente). Un ratio saludable es mayor a 1.5.">
                            <StatCard
                                label="Liquidez Corriente"
                                value={<KPIValue current={d.liquidity.current_ratio} previous={cd?.liquidity.current_ratio} showComparison={showComparison} />}
                                valueSize="xl"
                                accent="primary"
                                className="h-full"
                            >
                                <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${health.color}`}>
                                    {health.icon}{health.label}
                                    {showComparison && cd && (
                                        <DeltaBadge current={d.liquidity.current_ratio} previous={cd.liquidity.current_ratio} />
                                    )}
                                </div>
                            </StatCard>
                        </KPIWrapper>
                    )
                })()}

                {/* Prueba Ácida */}
                {(() => {
                    const health = getRatioHealth('acid_test', d.liquidity.acid_test || 0)
                    return (
                        <KPIWrapper tooltip="Similar a la liquidez corriente, pero excluye el inventario por ser menos líquido. Muestra si la empresa puede pagar sus pasivos inmediatos sin depender de la venta de stock.">
                            <StatCard
                                label="Prueba Ácida"
                                value={<KPIValue current={d.liquidity.acid_test || 0} previous={cd?.liquidity.acid_test || 0} showComparison={showComparison} />}
                                valueSize="xl"
                                accent="info"
                                className="h-full"
                            >
                                <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${health.color}`}>
                                    {health.icon}{health.label}
                                    {showComparison && cd && (
                                        <DeltaBadge current={d.liquidity.acid_test || 0} previous={cd.liquidity.acid_test || 0} />
                                    )}
                                </div>
                            </StatCard>
                        </KPIWrapper>
                    )
                })()}

                {/* D/E */}
                {(() => {
                    const health = getRatioHealth('debt_to_equity', d.structure.debt_to_equity)
                    return (
                        <KPIWrapper tooltip="Indica qué proporción de la empresa está financiada por deuda externa frente a recursos propios. Un ratio menor a 1 se considera conservador.">
                            <StatCard
                                label="Endeudamiento (D/E)"
                                value={<KPIValue current={d.structure.debt_to_equity} previous={cd?.structure.debt_to_equity} showComparison={showComparison} />}
                                valueSize="xl"
                                accent="warning"
                                className="h-full"
                            >
                                <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${health.color}`}>
                                    {health.icon}{health.label}
                                    {showComparison && cd && (
                                        <DeltaBadge current={d.structure.debt_to_equity} previous={cd.structure.debt_to_equity} />
                                    )}
                                </div>
                            </StatCard>
                        </KPIWrapper>
                    )
                })()}

                {/* Solvencia */}
                {(() => {
                    const health = getRatioHealth('solvency_ratio', d.solvency.solvency_ratio)
                    return (
                        <KPIWrapper tooltip="Mide la viabilidad a largo plazo de la empresa comparando el total de sus activos con el total de sus deudas. Un ratio mayor a 2 sugiere solidez.">
                            <StatCard
                                label="Solvencia"
                                value={<KPIValue current={d.solvency.solvency_ratio} previous={cd?.solvency.solvency_ratio} showComparison={showComparison} />}
                                valueSize="xl"
                                accent="success"
                                className="h-full"
                            >
                                <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${health.color}`}>
                                    {health.icon}{health.label}
                                    {showComparison && cd && (
                                        <DeltaBadge current={d.solvency.solvency_ratio} previous={cd.solvency.solvency_ratio} />
                                    )}
                                </div>
                            </StatCard>
                        </KPIWrapper>
                    )
                })()}

                {/* Margen Bruto */}
                {(() => {
                    const health = getRatioHealth('gross_margin', d.profitability?.gross_margin || 0)
                    return (
                        <KPIWrapper tooltip="Porcentaje de ingresos que queda tras descontar el costo directo de los bienes vendidos (COGS). Refleja la eficiencia básica en la producción.">
                            <StatCard
                                label="Margen Bruto"
                                value={<KPIValue current={d.profitability?.gross_margin || 0} previous={cd?.profitability?.gross_margin || 0} showComparison={showComparison} isPercentage alreadyPercent={false} decimals={1} />}
                                valueSize="xl"
                                accent="accent"
                                className="h-full"
                            >
                                <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${health.color}`}>
                                    {health.icon}{health.label}
                                    {showComparison && cd && (
                                        <DeltaBadge current={d.profitability?.gross_margin || 0} previous={cd.profitability?.gross_margin || 0} />
                                    )}
                                </div>
                            </StatCard>
                        </KPIWrapper>
                    )
                })()}

                {/* Margen Neto */}
                {(() => {
                    const health = getRatioHealth('net_margin', d.profitability?.net_margin || 0)
                    return (
                        <KPIWrapper tooltip="Porcentaje de beneficio final obtenido por cada unidad de venta, tras descontar absolutamente todos los gastos, impuestos e intereses.">
                            <StatCard
                                label="Margen Neto"
                                value={<KPIValue current={d.profitability?.net_margin || 0} previous={cd?.profitability?.net_margin || 0} showComparison={showComparison} isPercentage alreadyPercent={false} decimals={1} />}
                                valueSize="xl"
                                accent="muted"
                                className="h-full"
                            >
                                <div className={`mt-1.5 flex items-center gap-1 text-[10px] font-bold ${health.color}`}>
                                    {health.icon}{health.label}
                                    {showComparison && cd && (
                                        <DeltaBadge current={d.profitability?.net_margin || 0} previous={cd.profitability?.net_margin || 0} />
                                    )}
                                </div>
                            </StatCard>
                        </KPIWrapper>
                    )
                })()}
            </div>

            {/* ── Row 2: Radar + Capital de Trabajo ── */}
            <div className="grid gap-6 md:grid-cols-2 mt-6">
                {/* Radar: Salud Financiera General */}
                <SectionCard
                    title="Salud Financiera General"
                    description="Índice normalizado 0–100 por indicador"
                    headerRight={showComparison && cd ? <ChartLegend items={[{ label: "Actual", color: "#1f77b4" }, { label: "Anterior", color: "#ff7f0e" }]} /> : undefined}
                >
                    <div className="h-full">
                        <RadarChart
                            data={radarData}
                            keys={radarKeys}
                            indexBy="indicador"
                            maxValue={100}
                            margin={{ top: 10, right: 80, bottom: 32, left: 80 }}
                            legends={[]}
                        />
                    </div>
                </SectionCard>

                {/* Bar: Capital de Trabajo */}
                <SectionCard
                    title="Capital de Trabajo"
                    description={`Activos y Pasivos Corrientes — Saldo: ${formatMoney(d.liquidity.current_assets - d.liquidity.current_liabilities)}`}
                    headerRight={showComparison && cd ? <ChartLegend items={[{ label: "Actual", color: "#1f77b4" }, { label: "Anterior", color: "#ff7f0e" }]} /> : undefined}
                >
                    <div className="h-full">
                        <BarChart
                            data={workingCapitalData}
                            keys={barKeys}
                            indexBy="name"
                            groupMode="grouped"
                            enableLabel={false}
                            margin={{ top: 10, right: 20, bottom: 20, left: 72 }}
                            axisBottom={{ tickSize: 0, tickPadding: 12 }}
                            axisLeft={{
                                tickSize: 0,
                                tickPadding: 12,
                                format: (v: number) => formatMoney(v),
                            }}
                            renderTooltip={({ id, indexValue, value }) => (
                                <div className="flex flex-col gap-0.5">
                                    <span className="font-medium">{String(indexValue)} ({id})</span>
                                    <span className="font-bold">{formatMoney(value)}</span>
                                </div>
                            )}
                            legends={[]}
                        />
                    </div>
                </SectionCard>
            </div>

            {/* ── Row 3: Pie Charts ── */}
            <div className="grid gap-6 md:grid-cols-2 mt-6">
                {/* Pie: Estructura de Financiamiento */}
                <SectionCard
                    title="Estructura de Financiamiento"
                    description="Distribución entre Deuda y Patrimonio"
                    headerRight={<ChartLegend items={[{ label: "Pasivos", color: "#1f77b4" }, { label: "Patrimonio", color: "#ff7f0e" }]} />}
                >
                    {showComparison && cd ? (
                        <div className="flex h-full gap-2">
                            <div className="flex-1 flex flex-col items-center">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actual</span>
                                <div className="w-full h-full">
                                    <PieChart
                                        data={structureData}
                                        enableArcLabels={false}
                                        innerRadius={0.55}
                                        renderTooltip={({ label, value }) => (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium">{String(label)}</span>
                                                <span className="font-bold">{formatMoney(value)}</span>
                                            </div>
                                        )}
                                        legends={[]}
                                        margin={{ top: 16, right: 16, bottom: 20, left: 16 }}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col items-center">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Anterior</span>
                                <div className="w-full h-full">
                                    <PieChart
                                        data={structureDataComp}
                                        enableArcLabels={false}
                                        innerRadius={0.55}
                                        renderTooltip={({ label, value }) => (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium">{String(label)}</span>
                                                <span className="font-bold">{formatMoney(value)}</span>
                                            </div>
                                        )}
                                        legends={[]}
                                        margin={{ top: 16, right: 16, bottom: 20, left: 16 }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full">
                            <PieChart
                                data={structureData}
                                enableArcLabels={false}
                                innerRadius={0.55}
                                renderTooltip={({ label, value }) => (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-medium">{String(label)}</span>
                                        <span className="font-bold">{formatMoney(value)}</span>
                                    </div>
                                )}
                                legends={[]}
                                margin={{ top: 16, right: 16, bottom: 20, left: 16 }}
                            />
                        </div>
                    )}
                </SectionCard>

                {/* Pie: Composición de Activos */}
                <SectionCard
                    title="Composición de Activos"
                    description="Corrientes vs No Corrientes"
                    headerRight={<ChartLegend items={[{ label: "Corrientes", color: "#1f77b4" }, { label: "No Corrientes", color: "#ff7f0e" }]} />}
                >
                    {showComparison && cd ? (
                        <div className="flex h-full gap-2">
                            <div className="flex-1 flex flex-col items-center">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Actual</span>
                                <div className="w-full h-full">
                                    <PieChart
                                        data={assetsDistribution}
                                        enableArcLabels={false}
                                        innerRadius={0.55}
                                        renderTooltip={({ label, value }) => (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium">{String(label)}</span>
                                                <span className="font-bold">{formatMoney(value)}</span>
                                            </div>
                                        )}
                                        legends={[]}
                                        margin={{ top: 16, right: 16, bottom: 20, left: 16 }}
                                    />
                                </div>
                            </div>
                            <div className="flex-1 flex flex-col items-center">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Anterior</span>
                                <div className="w-full h-full">
                                    <PieChart
                                        data={assetsDistributionComp}
                                        enableArcLabels={false}
                                        innerRadius={0.55}
                                        renderTooltip={({ label, value }) => (
                                            <div className="flex flex-col gap-0.5">
                                                <span className="font-medium">{String(label)}</span>
                                                <span className="font-bold">{formatMoney(value)}</span>
                                            </div>
                                        )}
                                        legends={[]}
                                        margin={{ top: 16, right: 16, bottom: 20, left: 16 }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="h-full">
                            <PieChart
                                data={assetsDistribution}
                                enableArcLabels={false}
                                innerRadius={0.55}
                                renderTooltip={({ label, value }) => (
                                    <div className="flex flex-col gap-0.5">
                                        <span className="font-medium">{String(label)}</span>
                                        <span className="font-bold">{formatMoney(value)}</span>
                                    </div>
                                )}
                                legends={[]}
                                margin={{ top: 16, right: 16, bottom: 20, left: 16 }}
                            />
                        </div>
                    )}
                </SectionCard>
            </div>

        </SkeletonShell>
    );
};
