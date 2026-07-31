"use client"

import { useMemo } from "react"
import type { Payroll } from "@/types/hr"
import { assignChartColors } from "@/lib/chart-colors"
import { groupBy } from "@/lib/analytics-helpers"
import type { Granularity } from "@/lib/analytics-helpers"

export interface PayrollAnalyticsData {
    // Resumen
    totalMasa: number
    totalLiquido: number
    totalDescuentos: number
    costoEmpresa: number
    count: number
    avgLiquido: number
    avgBase: number
    masaTrend: Array<{ period: string; masa: number; liquido: number }>
    paymentStatusDist: Array<{ id: string; value: number; color: string }>
    previredStatusDist: Array<{ id: string; value: number; color: string }>
    // Masa Salarial
    topEmpleados: Array<{ employee: string; liquido: number; haberes: number }>
    haberesVsLiquido: Array<{ employee: string; haberes: number; liquido: number }>
    salaryRanges: Array<{ id: string; value: number; color: string }>
    // Descuentos & Previred
    totalDescLegales: number
    totalAportePatr: number
    totalOtrosDesc: number
    totalAnticipos: number
    costoTotalByEmp: Array<Record<string, string | number>>
    // Dotacion
    diasByEmp: Array<{ employee: string; worked: number; absent: number }>
    absenciaTrend: Array<{ period: string; ausencias: number }>
    statusDist: Array<{ id: string; value: number; color: string }>
    draftCount: number
    avgAbsent: number
    avgWorked: number
}

const PAYMENT_STATUS_LABELS: Record<string, string> = {
    PAID: "Pagado",
    PARTIAL: "Parcial",
    PENDING: "Pendiente",
}

const SALARY_RANGES: { label: string; min: number; max: number }[] = [
    { label: "Hasta $500k",  min: 0,         max: 500_000 },
    { label: "$500k - $1M",  min: 500_000,   max: 1_000_000 },
    { label: "$1M - $1.5M",  min: 1_000_000, max: 1_500_000 },
    { label: "$1.5M - $2M",  min: 1_500_000, max: 2_000_000 },
    { label: "Mas de $2M",   min: 2_000_000, max: Infinity },
]

function buildPeriodKey(payroll: Payroll, g: Granularity): string {
    const year = payroll.period_year
    const month = payroll.period_month
    if (g === "year") return String(year)
    const mm = String(month).padStart(2, "0")
    return `${year}-${mm}`
}

function periodSortValue(key: string, g: Granularity): number {
    if (g === "year") return parseInt(key, 10)
    const [y, m] = key.split("-").map(Number)
    return (y ?? 0) * 12 + (m ?? 0)
}

export function usePayrollAnalyticsData(
    payrolls: Payroll[],
    granularity?: Granularity,
): PayrollAnalyticsData {
    return useMemo(() => {
        const safe = Array.isArray(payrolls) ? payrolls : []
        const g = granularity ?? "month"

        // Aggregates
        const totalMasa       = safe.reduce((s, p) => s + Number(p.total_haberes   || 0), 0)
        const totalLiquido    = safe.reduce((s, p) => s + Number(p.net_salary      || 0), 0)
        const totalDescuentos = safe.reduce((s, p) => s + Number(p.total_descuentos || 0), 0)
        const count = safe.length
        const avgLiquido = count > 0 ? totalLiquido / count : 0
        const avgBase    = count > 0 ? safe.reduce((s, p) => s + Number(p.base_salary || 0), 0) / count : 0

        type ExtPayroll = Payroll & Record<string, string>
        const costoEmpresa   = safe.reduce((s, p) => s + Number((p as ExtPayroll).employer_contribution   || 0), 0)
        const totalDescLegales = safe.reduce((s, p) => s + Number((p as ExtPayroll).legal_deductions_worker || 0), 0)
        const totalOtrosDesc   = safe.reduce((s, p) => s + Number((p as ExtPayroll).other_deductions        || 0), 0)
        const totalAnticipos   = safe.reduce((s, p) => s + Number((p as ExtPayroll).advances_total          || 0), 0)
        const totalAportePatr  = costoEmpresa

        // Trend: masa vs liquido by period
        const periodGroups = groupBy(safe, (p) => buildPeriodKey(p, g))
        const sortedPeriods = Object.keys(periodGroups).sort(
            (a, b) => periodSortValue(a, g) - periodSortValue(b, g),
        )
        const masaTrend = sortedPeriods.map((period) => ({
            period,
            masa:    periodGroups[period].reduce((s, p) => s + Number(p.total_haberes || 0), 0),
            liquido: periodGroups[period].reduce((s, p) => s + Number(p.net_salary    || 0), 0),
        }))

        // Payment status distributions
        const paymentStatusGroups = groupBy(safe, (p) => p.remuneration_paid_status || "PENDING")
        const paymentStatusDist = assignChartColors(
            Object.entries(paymentStatusGroups)
                .map(([id, items]) => ({ id: PAYMENT_STATUS_LABELS[id] ?? id, value: items.length }))
                .sort((a, b) => b.value - a.value),
        )

        const previredStatusGroups = groupBy(safe, (p) => (p as ExtPayroll).previred_paid_status || "PENDING")
        const previredStatusDist = assignChartColors(
            Object.entries(previredStatusGroups)
                .map(([id, items]) => ({ id: PAYMENT_STATUS_LABELS[id] ?? id, value: items.length }))
                .sort((a, b) => b.value - a.value),
        )

        // Per-employee aggregations
        const empGroups = groupBy(safe, (p) => p.employee_name || `Empleado ${p.employee}`)
        const empAggs = Object.entries(empGroups)
            .map(([employee, items]) => ({
                employee,
                haberes: items.reduce((s, p) => s + Number(p.total_haberes || 0), 0),
                liquido: items.reduce((s, p) => s + Number(p.net_salary    || 0), 0),
            }))
            .sort((a, b) => b.liquido - a.liquido)

        const topEmpleados     = empAggs.slice(0, 10)
        const haberesVsLiquido = empAggs.slice(0, 10)

        const salaryRanges = assignChartColors(
            SALARY_RANGES.map((r) => ({
                id: r.label,
                value: safe.filter((p) => {
                    const liq = Number(p.net_salary || 0)
                    return liq >= r.min && liq < r.max
                }).length,
            })).filter((r) => r.value > 0),
        )

        // Stacked bar: costo total by employee
        const costoTotalByEmp: Array<Record<string, string | number>> = empAggs
            .slice(0, 10)
            .map((e) => {
                const items = empGroups[e.employee] ?? []
                return {
                    employee:   e.employee.split(" ")[0] ?? e.employee,
                    liquido:    items.reduce((s, p) => s + Number(p.net_salary    || 0), 0),
                    patronal:   items.reduce((s, p) => s + Number((p as ExtPayroll).employer_contribution || 0), 0),
                    descuentos: items.reduce((s, p) => s + Number(p.total_descuentos || 0), 0),
                }
            })

        // Dotacion: days data
        const diasByEmp = empAggs.slice(0, 10).map((e) => {
            const items = empGroups[e.employee] ?? []
            return {
                employee: e.employee.split(" ")[0] ?? e.employee,
                worked: items.reduce((s, p) => s + (p.worked_days ?? 0), 0),
                absent: items.reduce((s, p) => s + (p.absent_days ?? 0), 0),
            }
        })

        const absenciaTrend = sortedPeriods.map((period) => ({
            period,
            ausencias: periodGroups[period].reduce((s, p) => s + (p.absent_days ?? 0), 0),
        }))

        const avgAbsent = count > 0 ? safe.reduce((s, p) => s + (p.absent_days  ?? 0), 0) / count : 0
        const avgWorked = count > 0 ? safe.reduce((s, p) => s + (p.worked_days  ?? 0), 0) / count : 0

        const statusGroups = groupBy(safe, (p) => p.status)
        const statusDist = assignChartColors(
            Object.entries(statusGroups)
                .map(([id, items]) => ({
                    id: id === "DRAFT" ? "Borrador" : "Contabilizado",
                    value: items.length,
                }))
                .sort((a, b) => b.value - a.value),
        )
        const draftCount = safe.filter((p) => p.status === "DRAFT").length

        return {
            totalMasa,
            totalLiquido,
            totalDescuentos,
            costoEmpresa,
            count,
            avgLiquido,
            avgBase,
            masaTrend,
            paymentStatusDist,
            previredStatusDist,
            topEmpleados,
            haberesVsLiquido,
            salaryRanges,
            totalDescLegales,
            totalAportePatr,
            totalOtrosDesc,
            totalAnticipos,
            costoTotalByEmp,
            diasByEmp,
            absenciaTrend,
            statusDist,
            draftCount,
            avgAbsent,
            avgWorked,
        }
    }, [payrolls, granularity])
}
