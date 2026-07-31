"use client"

import React, { useState, useMemo, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { toast } from "sonner"
import { CreatePayrollDrawer, PayrollDetailDrawer, deletePayroll, paySalary, payPrevired, createAdvance, triggerDraftPayrolls, usePayrollAnalyticsData } from '@/features/hr'
import type { Payroll } from "@/types/hr"
import { type ColumnDef } from "@tanstack/react-table"
import { DataTableView, AutoEntityCard, type ToolbarActionItem } from '@/components/shared'
import type { AnalyticsPanelConfig, Granularity } from '@/components/shared'
import { BarChart3, Users, Scissors, CalendarDays } from "lucide-react"
import { FileText } from "lucide-react"
import { formatCurrency } from "@/lib/money"
import { payrollActions, type PayrollActionsCtx } from '@/features/hr/payrollActions'
import { PaymentModal } from "@/features/treasury"
import { ToolbarCreateButton, UnifiedSearchBar, useUnifiedSearch } from "@/components/shared"
import { useSelectedEntity } from "@/hooks/useSelectedEntity"
import { usePayrolls } from "@/features/hr"
import { useServerDate } from "@/hooks/useServerDate"
import { payrollUnifiedSearchDef } from "@/features/hr/unifiedSearchDef"
import { payrollFields } from '../payrollFields'

interface PayrollClientViewProps {
    initialPayrolls?: Payroll[]
}

export function PayrollClientView({ initialPayrolls }: PayrollClientViewProps) {
    const { dateString } = useServerDate()

    const createAction = <ToolbarCreateButton label="Generar Liquidaciones" href="/hr/payrolls?modal=new" />

    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const search = useUnifiedSearch(payrollUnifiedSearchDef)
    const { payrolls, isLoading: loading, isRefetching, refetch: fetchPayrolls } = usePayrolls(search.filters, initialPayrolls)

    const [granularity, setGranularity] = useState<Granularity>("month")
    const [analyticsActiveTab, setAnalyticsActiveTab] = useState("resumen")
    const analyticsData = usePayrollAnalyticsData(payrolls, granularity)

    const handleGenerateDrafts = useCallback(async () => {
        if (!confirm("¿Generar automáticamente liquidaciones borrador para todos los empleados activos este mes?")) return
        try {
            const res = await triggerDraftPayrolls()
            toast.success(res.detail)
            fetchPayrolls()
        } catch (err) {
            console.error('[PayrollClientView] Error al generar borradores:', err)
            const apiMsg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
            toast.error(apiMsg || "Error al iniciar tarea")
        }
    }, [fetchPayrolls])

    const toolbarActions: ToolbarActionItem[] = useMemo(() => [
        { key: 'generate_drafts', label: 'Generar borradores', icon: FileText, onClick: handleGenerateDrafts },
    ], [handleGenerateDrafts])

    const analyticsPanel: AnalyticsPanelConfig = useMemo(() => ({
        screen: {
            entityName: "Remuneraciones",
            activeTab: analyticsActiveTab,
            onTabChange: setAnalyticsActiveTab,
            granularity,
            onGranularityChange: setGranularity,
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
        },
    }), [analyticsData, analyticsActiveTab, granularity])

    const { entity: selectedFromUrl, clearSelection } = useSelectedEntity<Payroll>({
        endpoint: '/hr/payrolls'
    })

    const detailSheetOpen = !!selectedFromUrl
    const activePayrollId = selectedFromUrl?.id ?? null

    const isNewModalOpen = searchParams.get("modal") === "new"
    // Derive from URL directly — no useState + useEffect needed
    const dialogOpen = isNewModalOpen

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            const params = new URLSearchParams(searchParams.toString())
            params.delete("modal")
            router.push(`?${params.toString()}`, { scroll: false })
        }
    }

    const [selectedPayroll, setSelectedPayroll] = useState<Payroll | null>(null)
    const [paymentMode, setPaymentMode] = useState<'SALARY' | 'PREVIRED' | 'ADVANCE' | null>(null)

    const openDetail = (id: number) => {
        const params = new URLSearchParams(searchParams.toString())
        params.set('selected', String(id))
        router.push(`${pathname}?${params.toString()}`, { scroll: false })
    }

    const handleConfirmPayment = async (data: Record<string, unknown>) => {
        if (!selectedPayroll || !paymentMode) return

        try {
            if (paymentMode === 'SALARY') {
                await paySalary(selectedPayroll.id, data)
                toast.success("Pago de remuneración registrado")
            } else if (paymentMode === 'PREVIRED') {
                await payPrevired(selectedPayroll.id, data)
                toast.success("Pago Previred registrado")
            } else if (paymentMode === 'ADVANCE') {
                await createAdvance({
                    employee: selectedPayroll.employee,
                    payroll: selectedPayroll.id,
                    amount: data.amount as string,
                    date: (data.documentDate as string) || dateString,
                    notes: "Anticipo de sueldo",
                    ...data
                })
                toast.success("Anticipo registrado")
            }
            setPaymentMode(null)
            setSelectedPayroll(null)
            fetchPayrolls()
        } catch (err: unknown) {
            toast.error((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "Error al procesar")
        }
    }

    const actionsCtx: PayrollActionsCtx = {
        onViewDetail: openDetail,
        onRegisterAdvance: (p) => { setSelectedPayroll(p); setPaymentMode('ADVANCE') },
        onPaySalary: (p) => { setSelectedPayroll(p); setPaymentMode('SALARY') },
        onPayPrevired: (p) => { setSelectedPayroll(p); setPaymentMode('PREVIRED') },
        onDeleteDraft: async (id) => {
            if (confirm("¿Eliminar borrador?")) {
                try {
                    await deletePayroll(id);
                    toast.success("Borrador eliminado");
                    fetchPayrolls();
                } catch {
                    toast.error("Error al eliminar");
                }
            }
        },
    }

    const columns: ColumnDef<Payroll>[] = [
        ...payrollFields.toColumns(),
        payrollActions.auto(actionsCtx, "Acciones"),
    ]

    return (
        <div className="flex-1 min-h-0 flex flex-col">
            <CreatePayrollDrawer
                open={dialogOpen}
                onOpenChange={handleOpenChange}
                onSaved={(id) => { handleOpenChange(false); openDetail(id) }}
            />

            <div className="flex-1 min-h-0">
                <DataTableView
                    columns={columns}
                    data={payrolls}
                    isLoading={loading}
                    isRefetching={isRefetching}
                    entityLabel="hr.payroll"
                    variant="embedded"
                    analyticsPanel={analyticsPanel}
                    unifiedSearch={<UnifiedSearchBar
                        config={payrollUnifiedSearchDef}
                        chips={search.chips}
                        isFiltered={search.isFiltered}
                        inputValue={search.inputValue}
                        onInputChange={search.setInputValue}
                        onApply={search.applyFilter}
                        onRemove={search.removeFilter}
                        onClearAll={search.clearAll}
                        groupBy={search.groupBy}
                        onGroupBySelect={search.setGroupBy}
                        paramValues={search.paramValues}
                        placeholder="Buscar por empleado o período..."
                    />}
                    unifiedSearchConfig={payrollUnifiedSearchDef}
                    currentGroupBy={search.groupBy}
                    showReset={search.isFiltered}
                    onReset={search.clearAll}
                    defaultPageSize={20}
                    onRowClick={(row: Payroll) => openDetail(row.id)}
                    createAction={createAction}
                    toolbarActions={toolbarActions}
                    isFiltered={search.isFiltered}
                    emptyState={{
                        context: "finance",
                        title: "Aún no hay nóminas",
                        description: "Genera una nómina para liquidar los sueldos del período.",
                    }}
                    renderCard={(payroll: Payroll) => (
                        <AutoEntityCard
                            key={payroll.id}
                            data={payroll}
                            fields={payrollFields}

                            entityLabel="hr.payroll"

                            actions={payrollActions.render(payroll, actionsCtx)}
                            defaultAction={() => openDetail(payroll.id)}
                        />
                    )}
                />
            </div>

            <PayrollDetailDrawer
                payrollId={activePayrollId}
                open={detailSheetOpen}
                onOpenChange={(open) => {
                    if (!open) clearSelection()
                }}
                onUpdate={fetchPayrolls}
            />

            <PaymentModal
                open={!!paymentMode}
                onOpenChange={(o) => !o && setPaymentMode(null)}
                isPurchase={true}
                title={
                    paymentMode === 'SALARY' ? `Pagar Remuneración: ${selectedPayroll?.employee_name}` :
                        paymentMode === 'PREVIRED' ? `Pagar Previred: ${selectedPayroll?.employee_name}` :
                            `Registrar Anticipo: ${selectedPayroll?.employee_name}`
                }
                total={
                    paymentMode === 'SALARY' ? (selectedPayroll ? (Number((selectedPayroll as Payroll & Record<string, string>).net_salary) - Number((selectedPayroll as Payroll & Record<string, string>).advances_total || 0)) : 0) :
                        paymentMode === 'PREVIRED' ? Number((selectedPayroll as Payroll & Record<string, string>)?.total_previred || 0) :
                            Number((selectedPayroll as Payroll & Record<string, string>)?.net_salary || 0)
                }
                pendingAmount={
                    paymentMode === 'SALARY' ? (selectedPayroll ? (Number((selectedPayroll as Payroll & Record<string, string>).net_salary) - Number((selectedPayroll as Payroll & Record<string, string>).advances_total || 0)) : 0) :
                        paymentMode === 'PREVIRED' ? Number((selectedPayroll as Payroll & Record<string, string>)?.total_previred || 0) :
                            Number((selectedPayroll as Payroll & Record<string, string>)?.net_salary || 0)
                }
                onConfirm={handleConfirmPayment}
            />
        </div>
    )
}
