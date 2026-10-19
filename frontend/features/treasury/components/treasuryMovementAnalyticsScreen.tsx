import type { AnalyticsPanelContentProps, Granularity } from "@/components/shared"
import { KPIWrapper, KPIValue, StatCard } from "@/components/shared"
import { ArrowDownToLine, ArrowUpFromLine, TrendingUp, Landmark, CreditCard, ListFilter } from "lucide-react"
import { chartColor } from "@/lib/chart-colors"
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
    const ingresoColor = chartColor(0)
    const egresoColor = chartColor(1)
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
                                        <div className="grid gap-3 grid-cols-2 xl:grid-cols-4">
                                            <KPIWrapper tooltip="Número de transacciones de ingreso en el período: cobros, ventas y abonos de línea de crédito.">
                                                <StatCard label="Cantidad de Ingresos" className="h-full rounded-sm">
                                                    <div className="flex items-center gap-2" style={{ color: ingresoColor }}>
                                                        <ArrowDownToLine className="h-5 w-5" />
                                                        <span className="text-3xl font-black tracking-tighter">
                                                            <KPIValue current={inCount} />
                                                        </span>
                                                    </div>
                                                </StatCard>
                                            </KPIWrapper>
                                            <KPIWrapper tooltip="Valor total de los fondos que ingresaron en el período.">
                                                <StatCard label="Valor Total de Ingresos" className="h-full rounded-sm">
                                                    <div className="flex items-center gap-2" style={{ color: ingresoColor }}>
                                                        <ArrowDownToLine className="h-5 w-5" />
                                                        <span className="text-3xl font-black tracking-tighter">
                                                            <KPIValue current={inValue} isCurrency />
                                                        </span>
                                                    </div>
                                                </StatCard>
                                            </KPIWrapper>
                                            <KPIWrapper tooltip="Número de transacciones de egreso en el período: pagos, gastos y disposiciones de línea de crédito.">
                                                <StatCard label="Cantidad de Egresos" className="h-full rounded-sm">
                                                    <div className="flex items-center gap-2" style={{ color: egresoColor }}>
                                                        <ArrowUpFromLine className="h-5 w-5" />
                                                        <span className="text-3xl font-black tracking-tighter">
                                                            <KPIValue current={outCount} />
                                                        </span>
                                                    </div>
                                                </StatCard>
                                            </KPIWrapper>
                                            <KPIWrapper tooltip="Valor total de los fondos que salieron en el período.">
                                                <StatCard label="Valor Total de Egresos" className="h-full rounded-sm">
                                                    <div className="flex items-center gap-2" style={{ color: egresoColor }}>
                                                        <ArrowUpFromLine className="h-5 w-5" />
                                                        <span className="text-3xl font-black tracking-tighter">
                                                            <KPIValue current={outValue} isCurrency />
                                                        </span>
                                                    </div>
                                                </StatCard>
                                            </KPIWrapper>
                                        </div>
                                    ),
                                },
                            },
                            {
                                id: "flow-evolution",
                                content: hasFlowData ? {
                                    type: 'stat-card',
                                    config: {
                                        label: 'Evolución del Flujo',
                                        variant: 'chart',
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
                                    type: 'stat-card',
                                    config: {
                                        label: 'Movimientos por Cuenta',
                                        variant: 'chart',
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
                                    type: 'stat-card',
                                    config: {
                                        label: 'Transacciones por Método de Pago',
                                        variant: 'chart',
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
                                    type: 'stat-card',
                                    config: {
                                        label: 'Transacciones por Tipo',
                                        variant: 'chart',
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
