import type { AnalyticsPanelContentProps, Granularity } from "@/components/shared"
import { Metric, MetricStrip } from "@/components/shared"
import { formatMoney, formatQuantity } from "@/lib/money"
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, Landmark, CreditCard, ListFilter } from "lucide-react"
import type { TreasuryMovementAnalyticsData } from "../hooks/useTreasuryMovementAnalytics"

export interface TreasuryMovementAnalyticsUi {
    activeTab: string
    onTabChange: (tab: string) => void
    granularity: Granularity
    onGranularityChange: (granularity: Granularity) => void
}

/** Analytics tabs of the treasury movements screen (ADR-0087 oleada C1, extracted from TreasuryMovementsClientView). */
// eslint-disable-next-line naming/component-suffix -- a data builder (AnalyticsPanelContentProps), not a component; some of its "custom" sections embed JSX, which is why this file is .tsx.
export function buildTreasuryMovementAnalyticsScreen(analyticsData: TreasuryMovementAnalyticsData, ui: TreasuryMovementAnalyticsUi): AnalyticsPanelContentProps {
    const hasFlowData = analyticsData.flowLineChart.some(series => series.data.some(d => d.y > 0))
    const directions = analyticsData.analytics?.direction_distribution ?? []
    const inRow = directions.find(d => d.id === "IN")
    const outRow = directions.find(d => d.id === "OUT")
    const inCount = inRow?.count ?? 0
    const outCount = outRow?.count ?? 0
    const inValue = inRow ? parseFloat(inRow.amount) : 0
    const outValue = outRow ? parseFloat(outRow.amount) : 0
    const hasAccounts = analyticsData.accountBar.length > 0
    const hasMethods = analyticsData.paymentMethodPie.length > 0
    const hasTypes = analyticsData.typePie.length > 0

    return {
        entityName: "Tesorería",
        activeTab: ui.activeTab,
        onTabChange: ui.onTabChange,
        granularity: ui.granularity,
        onGranularityChange: ui.onGranularityChange,
        tabs: [
            {
                value: "flujo",
                label: "Flujo",
                icon: TrendingUp,
                columns: [
                    {
                        id: "col-evolution",
                        weight: 3,
                        sections: [
                            {
                                id: "kpi-row",
                                fillRemaining: false,
                                content: {
                                    type: 'custom',
                                    render: (
                                        <MetricStrip label="Indicadores de flujo">
                                            <Metric label="Cantidad de Ingresos" info="Número de transacciones de ingreso en el período: cobros, ventas y abonos de línea de crédito." lead={ArrowDownToLine} tone="success" value={formatQuantity(inCount)} />
                                            <Metric label="Valor Total de Ingresos" info="Valor total de los fondos que ingresaron en el período." lead={ArrowDownToLine} tone="success" value={formatMoney(inValue)} />
                                            <Metric label="Cantidad de Egresos" info="Número de transacciones de egreso en el período: pagos, gastos y disposiciones de línea de crédito." lead={ArrowUpFromLine} tone="destructive" value={formatQuantity(outCount)} />
                                            <Metric label="Valor Total de Egresos" info="Valor total de los fondos que salieron en el período." lead={ArrowUpFromLine} tone="destructive" value={formatMoney(outValue)} />
                                        </MetricStrip>
                                    ),
                                },
                            },
                            {
                                id: "flow-evolution",
                                content: hasFlowData ? {
                                    type: 'chart-card',
                                    config: {
                                        title: 'Evolución del Flujo',
                                        chart: {
                                            type: 'line-chart',
                                            preset: 'card',
                                            data: analyticsData.flowLineChart,
                                            showLegend: true,
                                            enableArea: true,
                                            valueFormat: ',.1f',
                                        },
                                    },
                                } : {
                                    type: 'custom',
                                    render: (
                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin movimientos en el período</p>
                                    ),
                                },
                            },
                        ],
                    },
                ],
            },
            {
                value: "cuentas",
                label: "Cuentas",
                icon: Landmark,
                columns: [
                    {
                        id: "col-accounts",
                        weight: 2,
                        sections: [
                            {
                                id: 'accounts-bar',
                                content: hasAccounts ? {
                                    type: 'chart-card',
                                    config: {
                                        title: 'Movimientos por Cuenta',
                                        chart: {
                                            type: 'bar-chart',
                                            preset: 'card',
                                            data: analyticsData.accountBar,
                                            keys: ['ingresos', 'egresos'],
                                            indexBy: 'cuenta',
                                            valueFormat: '$,.0f',
                                            showLegend: true,
                                        },
                                    },
                                } : {
                                    type: 'custom',
                                    render: (
                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de cuentas</p>
                                    ),
                                },
                            },
                        ],
                    },
                ],
            },
            {
                value: "metodos",
                label: "Métodos de Pago",
                icon: CreditCard,
                columns: [
                    {
                        id: "col-methods",
                        weight: 1,
                        sections: [
                            {
                                id: 'methods-pie',
                                content: hasMethods ? {
                                    type: 'chart-card',
                                    config: {
                                        title: 'Transacciones por Método de Pago',
                                        chart: {
                                            type: 'pie-chart',
                                            preset: 'card',
                                            data: analyticsData.paymentMethodPie,
                                            valueFormat: 'number',
                                            enableLabels: true,
                                        },
                                    },
                                } : {
                                    type: 'custom',
                                    render: (
                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de métodos de pago</p>
                                    ),
                                },
                            },
                        ],
                    },
                ],
            },
            {
                value: "tipos",
                label: "Tipos",
                icon: ListFilter,
                columns: [
                    {
                        id: "col-types",
                        weight: 1,
                        sections: [
                            {
                                id: 'types-pie',
                                content: hasTypes ? {
                                    type: 'chart-card',
                                    config: {
                                        title: 'Transacciones por Tipo',
                                        chart: {
                                            type: 'pie-chart',
                                            preset: 'card',
                                            data: analyticsData.typePie,
                                            valueFormat: 'number',
                                            enableLabels: true,
                                        },
                                    },
                                } : {
                                    type: 'custom',
                                    render: (
                                        <p className="text-sm text-muted-foreground italic py-4 text-center">Sin datos de tipos</p>
                                    ),
                                },
                            },
                        ],
                    },
                ],
            },
        ],
    }
}
