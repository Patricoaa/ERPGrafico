import type { AnalyticsPanelContentProps, Granularity } from "@/components/shared"
import { formatCurrency } from "@/lib/money"
import { BarChart3, Users, Scissors, CalendarDays } from "lucide-react"
import type { PayrollAnalyticsData } from "../hooks/usePayrollAnalyticsData"

export interface PayrollAnalyticsUi {
    activeTab: string
    onTabChange: (tab: string) => void
    granularity: Granularity
    onGranularityChange: (granularity: Granularity) => void
}

/** Analytics tabs of the payroll screen (ADR-0087 oleada B5, extracted from PayrollClientView). */
export function buildPayrollAnalyticsScreen(analyticsData: PayrollAnalyticsData, ui: PayrollAnalyticsUi): AnalyticsPanelContentProps {
    return {
        entityName: "Remuneraciones",
        activeTab: ui.activeTab,
        onTabChange: ui.onTabChange,
        granularity: ui.granularity,
        onGranularityChange: ui.onGranularityChange,
        tabs: [
            // ── Tab 1: Resumen ─────────────────────────────────────────
            {
                value: "resumen",
                label: "Resumen",
                icon: BarChart3,
                gridRows: "max-content 1fr",
                columns: [
                    {
                        id: "kpi-masa",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-masa-total",
                                fillRemaining: false,
                                colSpan: 1,
                                content: { type: "metric", config: { label: "Masa Salarial", value: formatCurrency(analyticsData.totalMasa), } },
                            },
                        ],
                    },
                    {
                        id: "kpi-liquido",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-liquido-total",
                                fillRemaining: false,
                                colSpan: 1,
                                content: { type: "metric", config: { label: "Total Líquido", value: formatCurrency(analyticsData.totalLiquido), tone: "success" } },
                            },
                        ],
                    },
                    {
                        id: "kpi-descuentos",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-descuentos-total",
                                fillRemaining: false,
                                colSpan: 1,
                                content: { type: "metric", config: { label: "Total Descuentos", value: formatCurrency(analyticsData.totalDescuentos), tone: "warning" } },
                            },
                        ],
                    },
                    {
                        id: "kpi-count",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-nominas",
                                fillRemaining: false,
                                colSpan: 1,
                                content: { type: "metric", config: { label: "Liquidaciones", value: String(analyticsData.count), } },
                            },
                        ],
                    },
                    {
                        id: "kpi-empresa",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-costo-empresa",
                                fillRemaining: false,
                                colSpan: 1,
                                content: { type: "metric", config: { label: "Costo Empresa", value: formatCurrency(analyticsData.costoEmpresa), } },
                            },
                        ],
                    },
                    {
                        id: "charts-row",
                        weight: 3,
                        sections: [
                            {
                                id: "masa-trend-chart",
                                colSpan: 2,
                                content: {
                                    type: "chart-card",
                                    config: {
                                        title: "Evolución de Masa Salarial",
                                        subtitle: "Haberes brutos vs líquido a percibir por período",
                                        chart: {
                                            type: "line-chart",
                                            preset: "card",
                                            data: [
                                                { id: "Masa Salarial", data: analyticsData.masaTrend.map((m) => ({ x: m.period, y: m.masa })) },
                                                { id: "Líquido",       data: analyticsData.masaTrend.map((m) => ({ x: m.period, y: m.liquido })) },
                                            ],
                                            showLegend: true,
                                            valueFormat: "$,.0f",
                                        },
                                    },
                                },
                            },
                            {
                                id: "payment-status-chart",
                                colSpan: 1,
                                content: {
                                    type: "chart-card",
                                    config: {
                                        title: "Estado de Pago",
                                        subtitle: "Remuneraciones pagadas, parciales y pendientes",
                                        chart: {
                                            type: "pie-chart",
                                            preset: "card",
                                            data: analyticsData.paymentStatusDist,
                                            valueFormat: "number",
                                            compact: true,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },

            // ── Tab 2: Masa Salarial ────────────────────────────────────
            {
                value: "masa",
                label: "Masa Salarial",
                icon: Users,
                columns: [
                    {
                        id: "col-charts",
                        weight: 2,
                        sections: [
                            {
                                id: "top-empleados-bar",
                                content: {
                                    type: "chart-card",
                                    config: {
                                        title: "Top Empleados por Líquido",
                                        subtitle: "Empleados con mayor sueldo líquido en el período",
                                        chart: {
                                            type: "bar-chart",
                                            preset: "card",
                                            data: analyticsData.topEmpleados.map((e) => ({ employee: e.employee.split(" ")[0], liquido: e.liquido })),
                                            keys: ["liquido"],
                                            indexBy: "employee",
                                            valueFormat: "$,.0f",
                                        },
                                    },
                                },
                            },
                            {
                                id: "haberes-vs-liquido",
                                content: {
                                    type: "chart-card",
                                    config: {
                                        title: "Haberes vs Líquido por Empleado",
                                        subtitle: "Diferencia entre bruto y líquido a percibir",
                                        chart: {
                                            type: "bar-chart",
                                            preset: "card",
                                            data: analyticsData.haberesVsLiquido.map((e) => ({ employee: e.employee.split(" ")[0], haberes: e.haberes, liquido: e.liquido })),
                                            keys: ["haberes", "liquido"],
                                            indexBy: "employee",
                                            valueFormat: "$,.0f",
                                            showLegend: true,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-side",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-avg-liquido",
                                content: { type: "metric", config: { label: "Líquido Promedio", value: formatCurrency(analyticsData.avgLiquido), } },
                            },
                            {
                                id: "kpi-avg-base",
                                content: { type: "metric", config: { label: "Sueldo Base Promedio", value: formatCurrency(analyticsData.avgBase), } },
                            },
                            {
                                id: "salary-ranges-pie",
                                content: {
                                    type: "chart-card",
                                    config: {
                                        title: "Distribución por Rango Salarial",
                                        subtitle: "Concentración de sueldos líquidos por tramo",
                                        chart: {
                                            type: "pie-chart",
                                            preset: "card",
                                            data: analyticsData.salaryRanges,
                                            valueFormat: "number",
                                            compact: true,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },

            // ── Tab 3: Descuentos & Previred ────────────────────────────
            {
                value: "descuentos",
                label: "Descuentos & Previred",
                icon: Scissors,
                columns: [
                    {
                        id: "col-kpis",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-desc-legales",
                                content: { type: "metric", config: { label: "Desc. Legales Trabajador", value: formatCurrency(analyticsData.totalDescLegales), tone: "warning" } },
                            },
                            {
                                id: "kpi-aporte-patr",
                                content: { type: "metric", config: { label: "Aporte Patronal (Previred)", value: formatCurrency(analyticsData.totalAportePatr), tone: "destructive" } },
                            },
                            {
                                id: "kpi-otros-desc",
                                content: { type: "metric", config: { label: "Otros Descuentos", value: formatCurrency(analyticsData.totalOtrosDesc), } },
                            },
                            {
                                id: "kpi-anticipos",
                                content: { type: "metric", config: { label: "Anticipos Descontados", value: formatCurrency(analyticsData.totalAnticipos), tone: "warning" } },
                            },
                            {
                                id: "previred-status-pie",
                                content: {
                                    type: "chart-card",
                                    config: {
                                        title: "Estado Pago Previred",
                                        subtitle: "Previred pagado, parcial y pendiente",
                                        chart: {
                                            type: "pie-chart",
                                            preset: "card",
                                            data: analyticsData.previredStatusDist,
                                            valueFormat: "number",
                                            compact: true,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-costo-bar",
                        weight: 2,
                        sections: [
                            {
                                id: "costo-total-emp",
                                content: {
                                    type: "chart-card",
                                    config: {
                                        title: "Composición del Costo por Empleado",
                                        subtitle: "Líquido + aportes patronales + descuentos",
                                        chart: {
                                            type: "bar-chart",
                                            preset: "card",
                                            data: analyticsData.costoTotalByEmp,
                                            keys: ["liquido", "patronal", "descuentos"],
                                            indexBy: "employee",
                                            valueFormat: "$,.0f",
                                            showLegend: true,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                ],
            },

            // ── Tab 4: Dotación ─────────────────────────────────────────
            {
                value: "dotacion",
                label: "Dotación",
                icon: CalendarDays,
                columns: [
                    {
                        id: "col-dias",
                        weight: 2,
                        sections: [
                            {
                                id: "dias-by-emp",
                                content: {
                                    type: "chart-card",
                                    config: {
                                        title: "Días Trabajados vs Ausentes",
                                        subtitle: "Comparativo por empleado en el período",
                                        chart: {
                                            type: "bar-chart",
                                            preset: "card",
                                            data: analyticsData.diasByEmp,
                                            keys: ["worked", "absent"],
                                            indexBy: "employee",
                                            showLegend: true,
                                        },
                                    },
                                },
                            },
                            {
                                id: "ausencia-trend",
                                content: {
                                    type: "chart-card",
                                    config: {
                                        title: "Evolución de Ausencias",
                                        subtitle: "Total de días ausentes acumulados por período",
                                        chart: {
                                            type: "line-chart",
                                            preset: "card",
                                            data: [{ id: "Ausencias", data: analyticsData.absenciaTrend.map((m) => ({ x: m.period, y: m.ausencias })) }],
                                            enableArea: true,
                                        },
                                    },
                                },
                            },
                        ],
                    },
                    {
                        id: "col-kpis-dotacion",
                        weight: 1,
                        sections: [
                            {
                                id: "kpi-avg-absent",
                                content: { type: "metric", config: { label: "Prom. Días Ausentes", value: analyticsData.avgAbsent.toFixed(1), tone: "destructive" } },
                            },
                            {
                                id: "kpi-avg-worked",
                                content: { type: "metric", config: { label: "Prom. Días Trabajados", value: analyticsData.avgWorked.toFixed(1), tone: "success" } },
                            },
                            {
                                id: "status-liquidaciones-pie",
                                content: {
                                    type: "chart-card",
                                    config: {
                                        title: "Estado Liquidaciones",
                                        subtitle: "Borradores vs contabilizadas",
                                        chart: {
                                            type: "pie-chart",
                                            preset: "card",
                                            data: analyticsData.statusDist,
                                            valueFormat: "number",
                                            compact: true,
                                        },
                                    },
                                },
                            },
                            {
                                id: "kpi-draft-count",
                                content: { type: "metric", config: { label: "Borradores Pendientes", value: String(analyticsData.draftCount), tone: analyticsData.draftCount > 0 ? "warning" : "neutral" } },
                            },
                        ],
                    },
                ],
            },
        ],
    }
}
