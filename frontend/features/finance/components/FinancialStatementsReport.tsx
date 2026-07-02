"use client"

import React, { useState, useEffect } from "react"

import { EmptyState, FadeIn, MoneyDisplay, ReportTable, SkeletonShell, ReportToolbar } from '@/components/shared'
import { PageContainer } from "@/components/shared"
import { CashFlowTable, type CashFlowData } from "@/features/finance/components/CashFlowTable"
import { MappingConfigDrawer } from "@/features/finance/components/MappingConfigDrawer"
import { useMappingDrawer } from "@/features/finance/hooks/useMappingDrawer"
import { DistributionBar } from "@/features/finance/components/DistributionBar"
import type { BalanceSheetData, PLData, PLSection } from "@/features/finance/types"
import { type DateRange } from "react-day-picker"
import { format, startOfYear, subYears } from "date-fns"
import { es } from 'date-fns/locale'
import { cn } from "@/lib/utils"
import { useServerDate } from "@/hooks/useServerDate"

function SkeletonReportSection() {
    return (
        <div className="space-y-4">
            <div className="h-6 w-48 bg-muted/30 rounded animate-pulse" />
            <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="flex justify-between py-2 border-b border-border/20">
                        <div className="h-4 w-48 bg-muted/30 rounded animate-pulse" />
                        <div className="h-4 w-24 bg-muted/30 rounded animate-pulse" />
                    </div>
                ))}
                <div className="flex justify-between py-3 border-t-2 border-border/40 pt-3">
                    <div className="h-5 w-36 bg-muted/40 rounded animate-pulse" />
                    <div className="h-5 w-28 bg-muted/40 rounded animate-pulse" />
                </div>
            </div>
        </div>
    )
}

interface FinancialStatementsReportProps {
    activeTab: string
    onPeriodLabelChange?: (label: string) => void
    hideToolbar?: boolean
    hideChart?: boolean
}

import { useStatements } from "@/features/finance/hooks/useStatements"

export function FinancialStatementsReport({ activeTab, onPeriodLabelChange, hideToolbar, hideChart }: FinancialStatementsReportProps) {
    const [showComparison, setShowComparison] = useState(false)
    const { open: mappingOpen, onOpenChange: setMappingOpen, resolvedMappingType, openDrawer: openMappingDrawer } = useMappingDrawer(
        activeTab === 'pl' ? 'is' : activeTab === 'cf' ? 'cf' : 'bs'
    )
    type HeaderFormat = 'year' | 'month-year' | 'day-month-year'
    const [headerFormat, setHeaderFormat] = useState<HeaderFormat>('year')

    // Date State
    const { serverDate } = useServerDate()
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfYear(new Date()),
        to: new Date(),
    })

    const [compDate, setCompDate] = useState<DateRange | undefined>({
        from: startOfYear(subYears(new Date(), 1)),
        to: subYears(new Date(), 1),
    })

    // Sync with server date
    useEffect(() => {
        if (serverDate) {
            const d = serverDate
            requestAnimationFrame(() => {
                setDate({
                    from: startOfYear(d),
                    to: d,
                })
                setCompDate({
                    from: startOfYear(subYears(d, 1)),
                    to: subYears(d, 1),
                })
            })
        }
    }, [serverDate])

    const statementParams = {
        start_date: date?.from ? format(date.from, 'yyyy-MM-dd') : undefined,
        end_date: date?.to ? format(date.to, 'yyyy-MM-dd') : undefined,
        comp_start_date: compDate?.from ? format(compDate.from, 'yyyy-MM-dd') : undefined,
        comp_end_date: compDate?.to ? format(compDate.to, 'yyyy-MM-dd') : undefined,
        showComparison
    }

    const { balanceSheet: bsData, incomeStatement: plData, cashFlow: cfData, refetch, isError } = useStatements(statementParams)

    const getPeriodLabel = (range: DateRange | undefined) => {
        if (!range?.from || !range?.to) return ""
        const fromDate = range.from
        const toDate = range.to

        if (headerFormat === 'year') {
            const fromYear = fromDate.getFullYear()
            const toYear = toDate.getFullYear()
            if (fromYear === toYear) return `${fromYear}`
            return `${fromYear}-${toYear}`
        }

        if (headerFormat === 'month-year') {
            const fromStr = format(fromDate, 'MMM yyyy', { locale: es })
            const toStr = format(toDate, 'MMM yyyy', { locale: es })
            if (fromStr === toStr) return fromStr
            if (fromDate.getFullYear() === toDate.getFullYear()) {
                return `${format(fromDate, 'MMM', { locale: es })}-${format(toDate, 'MMM yyyy', { locale: es })}`
            }
            return `${format(fromDate, 'MMM yyyy', { locale: es })}-${format(toDate, 'MMM yyyy', { locale: es })}`
        }

        // Default to 'day-month-year'
        const fromStr = format(fromDate, 'dd/MM/yyyy')
        const toStr = format(toDate, 'dd/MM/yyyy')
        if (fromStr === toStr) return fromStr
        return `${fromStr} - ${toStr}`
    }

    const periodLabel = getPeriodLabel(date)
    const compPeriodLabel = getPeriodLabel(compDate)

    useEffect(() => {
        onPeriodLabelChange?.(periodLabel)
    }, [periodLabel, onPeriodLabelChange])

    if (isError) {
        return (
        <PageContainer scrollable className="px-0">
                <div className="w-full pt-4">
                    <EmptyState
                        context="finance"
                        title="Error al cargar estados financieros"
                        description="No se pudieron obtener los datos financieros. Intente nuevamente más tarde."
                    />
                </div>
            </PageContainer>
        )
    }

    const renderBSDistribution = (d: BalanceSheetData) => {
        const segments = [
            { label: "Activos", value: d.total_assets || 0, bgClass: "bg-asset", textClass: "text-asset-foreground" },
            { label: "Pasivos", value: d.total_liabilities || 0, bgClass: "bg-liability", textClass: "text-liability-foreground" },
            { label: "Patrimonio", value: d.total_equity || 0, bgClass: "bg-primary", textClass: "text-primary-foreground" },
        ]
        return <DistributionBar segments={segments} className="mb-6" />
    }

    const renderPLDistribution = (d: PLData) => {
        const sections = d.sections || []
        const incomeTotal = sections
            .filter(s => s.name.toLowerCase().includes('ingreso'))
            .reduce((sum, s) => sum + Math.abs(s.total || 0), 0)
        const expenseTotal = sections
            .filter(s => s.name.toLowerCase().includes('gasto') || s.name.toLowerCase().includes('costo'))
            .reduce((sum, s) => sum + Math.abs(s.total || 0), 0)

        if (incomeTotal === 0 && expenseTotal === 0) return null

        const segments = [
            ...(incomeTotal > 0 ? [{ label: "Ingresos", value: incomeTotal, bgClass: "bg-income" as const, textClass: "text-income-foreground" as const }] : []),
            ...(expenseTotal > 0 ? [{ label: "Costos y Gastos", value: expenseTotal, bgClass: "bg-expense" as const, textClass: "text-expense-foreground" as const }] : []),
        ]
        return <DistributionBar segments={segments} className="mb-6" />
    }

    const renderCFDistribution = (d: CashFlowData) => {
        const segments = [
            { label: "Operativo", value: Math.abs(d.total_operating || 0), bgClass: "bg-asset", textClass: "text-asset-foreground" },
            { label: "Inversión", value: Math.abs(d.total_investing || 0), bgClass: "bg-liability", textClass: "text-liability-foreground" },
            { label: "Financiamiento", value: Math.abs(d.total_financing || 0), bgClass: "bg-primary", textClass: "text-primary-foreground" },
        ]
        return <DistributionBar segments={segments} className="mb-6" />
    }

    return (
        <PageContainer scrollable className="px-0">
            <div className="w-full pt-4">
                {!hideToolbar && (
                    <ReportToolbar
                        headerFormat={headerFormat}
                        onHeaderFormatChange={setHeaderFormat}
                        date={date}
                        onDateChange={setDate}
                        showComparison={showComparison}
                        onShowComparisonChange={setShowComparison}
                        compDate={compDate}
                        onCompDateChange={setCompDate}
                        showMapeo
                        onMapeoClick={() => openMappingDrawer()}
                    />
                )}
                <FadeIn key={activeTab}>
                    <div className="mt-0 outline-none ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        {activeTab === "bs" && (
                            <>
                                {bsData ? (
                                    <div className="space-y-6">
                                        {(() => {
                                            const d = bsData as BalanceSheetData;
                                            return (
                                                <>
                                                    {!hideChart && renderBSDistribution(d)}
                                                    <ReportTable
                                                        title="Activos"
                                                        data={d.assets}
                                                        totalLabel="Total Activos"
                                                        totalValue={d.total_assets}
                                                        totalValueComp={d.total_assets_comp}
                                                        compPeriodLabel={compPeriodLabel}
                                                        periodLabel={periodLabel}
                                                        showComparison={showComparison}
                                                        accentColor="asset"
                                                        varianceDirection="higher-is-better"
                                                        embedded
                                                    />
                                                    <ReportTable
                                                        title="Pasivos"
                                                        data={d.liabilities}
                                                        totalLabel="Total Pasivos"
                                                        totalValue={d.total_liabilities}
                                                        totalValueComp={d.total_liabilities_comp}
                                                        compPeriodLabel={compPeriodLabel}
                                                        periodLabel={periodLabel}
                                                        showComparison={showComparison}
                                                        accentColor="liability"
                                                        varianceDirection="higher-is-better"
                                                        embedded
                                                    />
                                                    <ReportTable
                                                        title="Patrimonio"
                                                        data={d.equity}
                                                        totalLabel="Total Patrimonio"
                                                        totalValue={d.total_equity}
                                                        totalValueComp={d.total_equity_comp}
                                                        compPeriodLabel={compPeriodLabel}
                                                        periodLabel={periodLabel}
                                                        showComparison={showComparison}
                                                        accentColor="primary"
                                                        varianceDirection="higher-is-better"
                                                        embedded
                                                    />
                                                </>
                                            );
                                        })()}
                                    </div>
                                ) : (
                                    <SkeletonShell isLoading ariaLabel="Cargando balance">
                                        <div className="space-y-8">
                                            <SkeletonReportSection />
                                            <SkeletonReportSection />
                                            <SkeletonReportSection />
                                        </div>
                                    </SkeletonShell>
                                )}
                            </>
                        )}
                    </div>

                    <div className="mt-0 outline-none ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        {activeTab === "pl" && (
                            <>
                                {plData ? (
                                    <div className="space-y-6">
                                        {(() => {
                                            const d = plData as PLData;
                                            return (
                                                <>
                                                    {!hideChart && renderPLDistribution(d)}
                                                    {(d.sections || []).map((section: PLSection, idx: number) => (
                                                section.is_total ? (
                                                    <div key={idx} className={cn(
                                                        "py-6 px-4 flex justify-between items-center rounded-md my-4 transition-colors",
                                                        idx === (d.sections?.length || 0) - 1
                                                            ? "bg-primary text-primary-foreground shadow-elevated"
                                                            : "bg-muted/50 border"
                                                    )}>
                                                        <span className="text-lg font-bold uppercase tracking-tight">{section.name}</span>
                                                        <div className="flex space-x-12 items-center">
                                                            <div className="text-right">
                                                                <div className={cn("text-[10px] uppercase font-bold opacity-70", idx === (d.sections?.length || 0) - 1 ? "text-primary-foreground" : "text-muted-foreground")}>{periodLabel || 'Actual'}</div>
                                                                <div className="text-2xl font-black font-mono">
                                                                    <MoneyDisplay amount={section.total} />
                                                                </div>
                                                            </div>
                                                            {showComparison && (
                                                                <div className={cn("text-right border-l pl-12", idx === (d.sections?.length || 0) - 1 ? "border-primary-foreground/30" : "border")}>
                                                                    <div className={cn("text-[10px] uppercase font-bold opacity-70", idx === (d.sections?.length || 0) - 1 ? "text-primary-foreground" : "text-muted-foreground")}>{compPeriodLabel || 'Anterior'}</div>
                                                                    <div className={cn("text-2xl font-black font-mono opacity-80", idx === (d.sections?.length || 0) - 1 ? "text-primary-foreground" : "")}>
                                                                        <MoneyDisplay amount={section.total_comp} />
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <ReportTable
                                                        key={idx}
                                                        title={section.name}
                                                        data={section.tree}
                                                        totalLabel={`Total ${section.name}`}
                                                        totalValue={section.total}
                                                        totalValueComp={section.total_comp}
                                                        showComparison={showComparison}
                                                        accentColor={section.name.toLowerCase().includes('ingreso') ? 'income' : section.name.toLowerCase().includes('gasto') || section.name.toLowerCase().includes('costo') ? 'expense' : 'primary'}
                                                        varianceDirection={section.name.toLowerCase().includes('ingreso') ? 'higher-is-better' : 'lower-is-better'}
                                                        embedded
                                                    />
                                                )
                                            ))}
                                        </>
                                    );
                                })()}
                                    </div>
                                ) : (
                                    <SkeletonShell isLoading ariaLabel="Cargando estado de resultados">
                                        <div className="space-y-8">
                                            <SkeletonReportSection />
                                            <SkeletonReportSection />
                                            <SkeletonReportSection />
                                        </div>
                                    </SkeletonShell>
                                )}
                            </>
                        )}
                    </div>

                    <div className="mt-0 outline-none ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        {activeTab === "cf" && (
                            <>
                                {cfData ? (
                                    <div className="space-y-6">
                                        {!hideChart && renderCFDistribution(cfData as CashFlowData)}
                                        <CashFlowTable
                                            data={cfData as CashFlowData}
                                            embedded
                                            showComparison={showComparison}
                                            periodLabel={periodLabel}
                                            compPeriodLabel={compPeriodLabel}
                                        />
                                    </div>
                                    ) : (
                                        <SkeletonShell isLoading ariaLabel="Cargando flujo de efectivo">
                                            <div className="space-y-8">
                                                <SkeletonReportSection />
                                                <SkeletonReportSection />
                                            </div>
                                        </SkeletonShell>
                                    )}
                                </>
                            )}
                    </div>
                </FadeIn>
            </div>

            <MappingConfigDrawer
                open={mappingOpen}
                onOpenChange={setMappingOpen}
                mappingType={resolvedMappingType}
                onSaveSuccess={() => {
                    refetch()
                }}
            />
        </PageContainer>
    )
}
