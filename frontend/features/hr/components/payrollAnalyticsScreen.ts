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
                                content: { type: "stat-card", config: { label: "Masa Salarial", value: formatCurrency(analyticsData.totalMasa), variant: "hero", accent: "primary" } },
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
                                content: { type: "stat-card", config: { label: "Total Líquido", value: formatCurrency(analyticsData.totalLiquido), variant: "hero", accent: "success" } },
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
                                content: { type: "stat-card", config: { label: "Total Descuentos", value: formatCurrency(analyticsData.totalDescuentos), variant: "hero", accent: "warning" } },
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
                                content: { type: "stat-card", config: { label: "Liquidaciones", value: String(analyticsData.count), variant: "tile" } },
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
                                content: { type: "stat-card", config: { label: "Costo Empresa", value: formatCurrency(analyticsData.costoEmpresa), variant: "tile", accent: "info" } },
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
                                    type: "stat-card",
                                    config: {
                                        label: "Evolución de Masa Salarial",
                                        variant: "chart",
                                        subtext: "Haberes brutos vs líquido a percibir por período",
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
                                    type: "stat-card",
                                    config: {
                                        label: "Estado de Pago",
                                        variant: "chart",
                                        subtext: "Remuneraciones pagadas, parciales y pendientes",
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
                                    type: "stat-card",
                                    config: {
                                        label: "Top Empleados por Líquido",
                                        variant: "chart",
                                        subtext: "Empleados con mayor sueldo líquido en el período",
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
                                    type: "stat-card",
                                    config: {
                                        label: "Haberes vs Líquido por Empleado",
                                        variant: "chart",
                                        subtext: "Diferencia entre bruto y líquido a percibir",
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
                                content: { type: "stat-card", config: { label: "Líquido Promedio", value: formatCurrency(analyticsData.avgLiquido), accent: "primary" } },
                            },
                            {
                                id: "kpi-avg-base",
                                content: { type: "stat-card", config: { label: "Sueldo Base Promedio", value: formatCurrency(analyticsData.avgBase), accent: "info" } },
                            },
                            {
                                id: "salary-ranges-pie",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Distribución por Rango Salarial",
                                        variant: "chart",
                                        subtext: "Concentración de sueldos líquidos por tramo",
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
                                content: { type: "stat-card", config: { label: "Desc. Legales Trabajador", value: formatCurrency(analyticsData.totalDescLegales), accent: "warning" } },
                            },
                            {
                                id: "kpi-aporte-patr",
                                content: { type: "stat-card", config: { label: "Aporte Patronal (Previred)", value: formatCurrency(analyticsData.totalAportePatr), accent: "destructive" } },
                            },
                            {
                                id: "kpi-otros-desc",
                                content: { type: "stat-card", config: { label: "Otros Descuentos", value: formatCurrency(analyticsData.totalOtrosDesc), accent: "muted" } },
                            },
                            {
                                id: "kpi-anticipos",
                                content: { type: "stat-card", config: { label: "Anticipos Descontados", value: formatCurrency(analyticsData.totalAnticipos), accent: "warning" } },
                            },
                            {
                                id: "previred-status-pie",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Estado Pago Previred",
                                        variant: "chart",
                                        subtext: "Previred pagado, parcial y pendiente",
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
                                    type: "stat-card",
                                    config: {
                                        label: "Composición del Costo por Empleado",
                                        variant: "chart",
                                        subtext: "Líquido + aportes patronales + descuentos",
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
                                    type: "stat-card",
                                    config: {
                                        label: "Días Trabajados vs Ausentes",
                                        variant: "chart",
                                        subtext: "Comparativo por empleado en el período",
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
                                    type: "stat-card",
                                    config: {
                                        label: "Evolución de Ausencias",
                                        variant: "chart",
                                        subtext: "Total de días ausentes acumulados por período",
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
                                content: { type: "stat-card", config: { label: "Prom. Días Ausentes", value: analyticsData.avgAbsent.toFixed(1), accent: "destructive" } },
                            },
                            {
                                id: "kpi-avg-worked",
                                content: { type: "stat-card", config: { label: "Prom. Días Trabajados", value: analyticsData.avgWorked.toFixed(1), accent: "success" } },
                            },
                            {
                                id: "status-liquidaciones-pie",
                                content: {
                                    type: "stat-card",
                                    config: {
                                        label: "Estado Liquidaciones",
                                        variant: "chart",
                                        subtext: "Borradores vs contabilizadas",
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
                                content: { type: "stat-card", config: { label: "Borradores Pendientes", value: String(analyticsData.draftCount), accent: analyticsData.draftCount > 0 ? "warning" : "muted" } },
                            },
                        ],
                    },
                ],
            },
        ],
    }
}
