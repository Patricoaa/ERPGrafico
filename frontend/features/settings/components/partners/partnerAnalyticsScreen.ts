import type { AnalyticsPanelContentProps, Granularity } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { PieChart as PieChartIcon, Wallet, Gauge, TrendingUp } from "lucide-react"
import type { PartnerAnalyticsData } from "../../hooks/usePartnerAnalyticsData"
import type { PartnerEvolutionData } from "../../hooks/usePartnerEvolutionData"

export interface PartnerAnalyticsUi {
    activeTab: string
    onTabChange: (tab: string) => void
    granularity: Granularity
    onGranularityChange: (granularity: Granularity) => void
}

/** Analytics tabs of the partners screen (ADR-0087 oleada B5, extracted from PartnersClientView). */
export function buildPartnerAnalyticsScreen(analyticsData: PartnerAnalyticsData, evolutionData: PartnerEvolutionData, ui: PartnerAnalyticsUi): AnalyticsPanelContentProps {
    const equityEvolutionChart = evolutionData.periods.length > 0 ? [{
        id: "Patrimonio Neto",
        data: evolutionData.periods.map(p => ({ x: p.period, y: Number(p.net_equity) })),
    }] : []

    const compositionEvolutionChart = evolutionData.periods.length > 0 ? [
        { id: "Aportes", data: evolutionData.periods.map(p => ({ x: p.period, y: Number(p.total_contributions) })) },
        { id: "Retiros", data: evolutionData.periods.map(p => ({ x: p.period, y: Number(p.total_withdrawals) })) },
        { id: "Utilidades", data: evolutionData.periods.map(p => ({ x: p.period, y: Number(p.total_earnings) })) },
        { id: "Dividendos", data: evolutionData.periods.map(p => ({ x: p.period, y: Number(p.total_dividends) })) },
    ] : []

    return {
        entityName: "Composición Societaria",
        activeTab: ui.activeTab,
        onTabChange: ui.onTabChange,
        granularity: ui.granularity,
        onGranularityChange: ui.onGranularityChange,
        tabs: [
            {
                value: "composicion",
                label: "Composición",
                icon: PieChartIcon,
                columns: [
                    {
                        id: "col-kpis",
                        weight: 1,
                        sections: [
                            {
                                id: "neto-kpi",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Patrimonio Neto",
                                        value: formatCurrency(analyticsData.totalNetEquity),
                                        icon: TrendingUp,
                                        accent: "primary",
                                        valueSize: "xl",
                                        subtext: "Valor Libro de la Compañía",
                                    },
                                },
                            },
                            {
                                id: "socios-kpi",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Socios",
                                        value: analyticsData.partnerCount.toString(),
                                        icon: PieChartIcon,
                                        accent: "info",
                                        valueSize: "xl",
                                        subtext: "Total activos",
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-evolution",
                        weight: 1,
                        sections: [
                            {
                                id: "evolution-chart",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Evolución del Patrimonio Neto",
                                        variant: "chart",
                                        loading: evolutionData.isLoading,
                                        subtext: evolutionData.periods.length === 0 && !evolutionData.isLoading ? "Sin datos históricos de evolución" : undefined,
                                        chart: {
                                            type: "line-chart",
                                            preset: "card",
                                            data: equityEvolutionChart,
                                            enableArea: true,
                                            valueFormat: "currency",
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            {
                value: "socios",
                label: "Socios",
                icon: Gauge,
                columns: [
                    {
                        id: "col-dist",
                        weight: 1,
                        sections: [
                            {
                                id: "dist-pie",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Distribución Patrimonial",
                                        variant: "chart",
                                        subtext: analyticsData.equityDistribution.length === 0 ? "Sin datos de distribución" : undefined,
                                        chart: {
                                            type: "pie-chart",
                                            preset: "card",
                                            data: analyticsData.equityDistribution,
                                            valueFormat: "currency",
                                            innerRadius: 0.6,
                                            enableArcLinkLabels: false,
                                            arcLabel: (d: { id: string; value: number }) => {
                                                const total = analyticsData.equityDistribution.reduce((s, item) => s + item.value, 0)
                                                return total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : "0%"
                                            },
                                        },
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-capital",
                        weight: 1,
                        sections: [
                            {
                                id: "capital-bar",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Capital Enterado vs Pendiente",
                                        variant: "chart",
                                        chart: {
                                            type: "bar-chart",
                                            preset: "card",
                                            data: analyticsData.capitalComparison,
                                            keys: ["paid", "pending"],
                                            indexBy: "name",
                                            valueFormat: "$,.0f",
                                            borderRadius: 6,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-composition",
                        sections: [
                            {
                                id: "composition-line",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Composición Patrimonial",
                                        variant: "chart",
                                        loading: evolutionData.isLoading,
                                        subtext: evolutionData.periods.length === 0 && !evolutionData.isLoading ? "Sin datos históricos de evolución" : undefined,
                                        chart: {
                                            type: "line-chart",
                                            preset: "card",
                                            data: compositionEvolutionChart,
                                            enableArea: true,
                                            valueFormat: "currency",
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
            {
                value: "saldos",
                label: "Saldos",
                icon: Wallet,
                columns: [
                    {
                        id: "col-kpis",
                        sections: [
                            {
                                id: "retiros-kpi",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Retiros Provisorios Totales",
                                        value: formatCurrency(analyticsData.totalWithdrawals),
                                        icon: Wallet,
                                        accent: "destructive",
                                        valueSize: "xl",
                                        subtext: "Saldos provisorios",
                                    },
                                },
                            },
                            {
                                id: "utilidades-kpi",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Utilidades Acumuladas",
                                        value: formatCurrency(analyticsData.totalEarnings),
                                        icon: TrendingUp,
                                        accent: "success",
                                        valueSize: "xl",
                                        subtext: "Resultados retenidos",
                                    },
                                },
                            },
                            {
                                id: "dividendos-kpi",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Dividendos por Pagar",
                                        value: formatCurrency(analyticsData.totalDividendsPayable),
                                        icon: Wallet,
                                        accent: "warning",
                                        valueSize: "xl",
                                        subtext: "Obligaciones pendientes",
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-balance",
                        weight: 1,
                        sections: [
                            {
                                id: "balance-bar",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Composición de Saldos por Socio",
                                        variant: "chart",
                                        chart: {
                                            type: "bar-chart",
                                            preset: "card",
                                            data: analyticsData.balanceComposition.map(b => ({
                                                name: b.name,
                                                patrimonio: b.equity,
                                                utilidades: b.earnings,
                                                pendiente: b.pending,
                                                retiros: b.withdrawals,
                                            })),
                                            keys: ["patrimonio", "utilidades", "pendiente", "retiros"],
                                            indexBy: "name",
                                            valueFormat: "$,.0f",
                                            borderRadius: 6,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    }
}
