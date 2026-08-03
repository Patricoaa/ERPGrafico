"use client"

import React, { useState, useEffect } from "react"

import { FadeIn, ReportTable, SkeletonShell, ReportToolbar, StaleDataBanner } from '@/components/shared'
import { PageContainer } from "@/components/shared"
import { CashFlowTable, type CashFlowData } from "@/features/finance/components/CashFlowTable"
import { MappingConfigDrawer } from "@/features/finance/components/MappingConfigDrawer"
import { useMappingDrawer } from "@/features/finance/hooks/useMappingDrawer"
import type { BalanceSheetData, PLData } from "@/features/finance/types"
import { type DateRange } from "react-day-picker"
import { format, startOfYear, subYears } from "date-fns"
import { es } from 'date-fns/locale'
import { exportReportToCsv } from "@/lib/utils/export-report"
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
}

import { useStatements } from "@/features/finance/hooks/useStatements"

export function FinancialStatementsReport({ activeTab, onPeriodLabelChange, hideToolbar }: FinancialStatementsReportProps) {
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

    const handleExport = () => {
        const baseOpts = {
            periodLabel,
            compPeriodLabel,
            showComparison,
        }

        if (activeTab === 'bs' && bsData) {
            const d = bsData as BalanceSheetData
            exportReportToCsv([
                { id: 'assets', code: '', name: 'Activos', balance: d.total_assets, comp_balance: d.total_assets_comp, children: d.assets },
                { id: 'liabilities', code: '', name: 'Pasivos', balance: d.total_liabilities, comp_balance: d.total_liabilities_comp, children: d.liabilities },
                { id: 'equity', code: '', name: 'PATRIMONIO Y RESULTADOS', balance: d.total_equity, comp_balance: d.total_equity_comp, children: d.equity },
            ], { ...baseOpts, filename: `balance_general_${periodLabel}` })
        } else if (activeTab === 'pl' && plData) {
            const d = plData as PLData
            exportReportToCsv(
                (d.sections || []).map((sec, idx) => ({
                    id: `sec-${idx}`,
                    code: '',
                    name: sec.name,
                    balance: sec.total,
                    comp_balance: sec.total_comp,
                    children: sec.is_total ? undefined : sec.tree,
                    isTotalRow: sec.is_total,
                })),
                { ...baseOpts, filename: `estado_resultados_${periodLabel}` }
            )
        }
    }

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

    return (
        <PageContainer className="px-0 pt-0 flex flex-col gap-0 space-y-0">
            {isError && <StaleDataBanner onRetry={() => refetch()} className="mx-4 mb-2" />}
            {!hideToolbar && (
                <div className="shrink-0">
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
                        onExport={activeTab !== 'cf' ? handleExport : undefined}
                    />
                </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto">
                <FadeIn key={activeTab}>
                    <div className="mt-0 outline-none ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                        {activeTab === "bs" && (
                            <>
                                {bsData ? (
                                    <div className="space-y-6">
                                        {(() => {
                                            const d = bsData as BalanceSheetData;
                                            return (
                                                <ReportTable
                                                    data={[
                                                        {
                                                            id: 'assets',
                                                            code: '',
                                                            name: 'Activos',
                                                            balance: d.total_assets,
                                                            comp_balance: d.total_assets_comp,
                                                            children: d.assets,
                                                            varianceDirection: 'higher-is-better'
                                                        },
                                                        {
                                                            id: 'liabilities',
                                                            code: '',
                                                            name: 'Pasivos',
                                                            balance: d.total_liabilities,
                                                            comp_balance: d.total_liabilities_comp,
                                                            children: d.liabilities,
                                                            varianceDirection: 'lower-is-better'
                                                        },
                                                        {
                                                            id: 'equity',
                                                            code: '',
                                                            name: 'PATRIMONIO Y RESULTADOS',
                                                            balance: d.total_equity,
                                                            comp_balance: d.total_equity_comp,
                                                            children: d.equity,
                                                            varianceDirection: 'higher-is-better'
                                                        }
                                                    ]}
                                                    compPeriodLabel={compPeriodLabel}
                                                    periodLabel={periodLabel}
                                                    showComparison={showComparison}
                                                />
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
                                                <ReportTable
                                                    data={(d.sections || []).map((sec, idx) => ({
                                                        id: `sec-${idx}`,
                                                        code: '',
                                                        name: sec.name,
                                                        balance: sec.total,
                                                        comp_balance: sec.total_comp,
                                                        children: sec.is_total ? undefined : sec.tree,
                                                        isTotalRow: sec.is_total,
                                                        varianceDirection: sec.name.toLowerCase().includes('ingreso') ? 'higher-is-better' : 'lower-is-better'
                                                    }))}
                                                    compPeriodLabel={compPeriodLabel}
                                                    periodLabel={periodLabel}
                                                    showComparison={showComparison}
                                                />
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
