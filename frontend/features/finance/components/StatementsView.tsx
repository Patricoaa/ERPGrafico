"use client"

import React, { useState, useEffect } from "react"
import { TabsContent } from "@/components/ui/tabs"
import { Card, CardContent } from "@/components/ui/card"
import { SkeletonShell, MoneyDisplay, FadeIn } from "@/components/shared"
import { PageContainer } from "@/components/shared"
import { Button } from "@/components/ui/button"
import { SlidersHorizontal, ChevronDown, GitCompare } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuTrigger,
    DropdownMenuContent,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem
} from "@/components/ui/dropdown-menu"

import { ReportTable } from "@/components/shared/ReportTable"
import { CashFlowTable } from "@/features/finance/components/CashFlowTable"
import { MappingConfigSheet } from "@/features/finance/components/MappingConfigSheet"
import { DateRangeFilter } from "@/components/shared"
import { DateRange } from "react-day-picker"
import { format, startOfYear, subYears } from "date-fns"
import { es } from 'date-fns/locale'
import { cn } from "@/lib/utils"
import { useServerDate } from "@/hooks/useServerDate"

interface StatementsViewProps {
    activeTab: string
}

import { useStatements } from "@/features/finance/hooks/useStatements"

export function StatementsView({ activeTab }: StatementsViewProps) {
    const [showComparison, setShowComparison] = useState(false)
    const [mappingOpen, setMappingOpen] = useState(false)
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
            setDate({
                from: startOfYear(serverDate),
                to: serverDate,
            })
            setCompDate({
                from: startOfYear(subYears(serverDate, 1)),
                to: subYears(serverDate, 1),
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

    const { balanceSheet: bsData, incomeStatement: plData, cashFlow: cfData, refetch, isLoading } = useStatements(statementParams)


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

    const ReportHeader = ({ title, dateRange, compDateRange, showComparison, accent = 'primary' }: { title: string, dateRange?: DateRange, compDateRange?: DateRange, showComparison?: boolean, accent?: 'primary' | 'success' | 'info' }) => (
        <div className="flex flex-col items-start text-left space-y-1 mb-8 pb-6 border-b w-full relative">
            <h2 className="text-2xl font-black uppercase tracking-tight text-foreground dark:text-foreground">{title}</h2>
            {dateRange?.from && dateRange?.to && (
                <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1.5 flex-wrap">
                    <span>Período:</span>
                    <span className="font-bold text-foreground bg-foreground/5 px-2 py-0.5 rounded-sm border border-border/20">{getPeriodLabel(dateRange)}</span>
                    {showComparison && compDateRange?.from && compDateRange?.to && (
                        <>
                            <span className="text-[10px] text-muted-foreground/60 font-black uppercase px-0.5">vs</span>
                            <span className="font-bold text-foreground bg-foreground/5 px-2 py-0.5 rounded-sm border border-border/20">{getPeriodLabel(compDateRange)}</span>
                        </>
                    )}
                </p>
            )}
            <div className={cn(
                "absolute bottom-0 left-0 w-16 h-1 rounded-full",
                accent === 'primary' ? 'bg-primary' :
                    accent === 'success' ? 'bg-success' : 'bg-info'
            )} />
        </div>
    )

    const renderBSDistribution = () => {
        if (!bsData) return null
        const d = bsData as any
        const a = d.total_assets || 0
        const p = d.total_liabilities || 0
        const e = d.total_equity || 0
        const totalSum = a + p + e
        if (totalSum === 0) return null

        const aP = (a / totalSum) * 100
        const pP = (p / totalSum) * 100
        const eP = (e / totalSum) * 100

        const fmt = (val: number) => val.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })

        return (
            <div className="mb-10 overflow-hidden rounded-lg border shadow-sm">
                <div className="h-10 w-full flex text-[10px] font-bold text-white uppercase tracking-tighter">
                    <div
                        style={{ width: `${aP}%` }}
                        className="bg-success flex items-center justify-center p-1 transition-all border-r border-white/20 whitespace-nowrap overflow-hidden"
                        title={`Activos: ${fmt(a)}`}
                    >
                        Activos: {fmt(a)}
                    </div>
                    <div
                        style={{ width: `${pP}%` }}
                        className="bg-destructive flex items-center justify-center p-1 transition-all border-r border-white/20 whitespace-nowrap overflow-hidden"
                        title={`Pasivos: ${fmt(p)}`}
                    >
                        Pasivos: {fmt(p)}
                    </div>
                    <div
                        style={{ width: `${eP}%` }}
                        className="bg-primary flex items-center justify-center p-1 transition-all whitespace-nowrap overflow-hidden"
                        title={`Patrimonio: ${fmt(e)}`}
                    >
                        Patrimonio: {fmt(e)}
                    </div>
                </div>
            </div>
        )
    }

    const RenderToolbar = () => (
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-card/60 backdrop-blur-md p-4 rounded-md border border-border/50 shadow-sm shadow-black/5 transition-all">
            <div className="flex items-center gap-3">
                {/* ButtonGroup for Mapeo and Vista */}
                <div className="flex items-center -space-x-px shadow-xs rounded-sm">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setMappingOpen(true)}
                        className="text-[10px] font-black uppercase tracking-wider gap-1.5 hover:bg-primary/10 border border-border/50 px-3.5 py-2 rounded-l-md rounded-r-none transition-all duration-300 shadow-sm hover:scale-[1.01]"
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Mapeo
                    </Button>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-[10px] font-black uppercase tracking-wider rounded-r-md rounded-l-none border border-border/50 px-3.5 py-2 transition-all gap-1 bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                            >
                                Vista: {headerFormat === 'year' ? 'Año' : headerFormat === 'month-year' ? 'Mes/Año' : 'Día/Mes/Año'}
                                <ChevronDown className="h-3 w-3 opacity-60 ml-0.5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40 bg-card/95 backdrop-blur-md border border-border/50 rounded-sm shadow-xl p-1 z-50">
                            <DropdownMenuRadioGroup value={headerFormat} onValueChange={(val) => setHeaderFormat(val as HeaderFormat)}>
                                <DropdownMenuRadioItem value="year" className="text-[9px] font-black uppercase tracking-wider cursor-pointer">
                                    Año
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="month-year" className="text-[9px] font-black uppercase tracking-wider cursor-pointer">
                                    Mes/Año
                                </DropdownMenuRadioItem>
                                <DropdownMenuRadioItem value="day-month-year" className="text-[9px] font-black uppercase tracking-wider cursor-pointer">
                                    Día/Mes/Año
                                </DropdownMenuRadioItem>
                            </DropdownMenuRadioGroup>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Standalone Comparar Toggle Button on the right of the ButtonGroup */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowComparison(!showComparison)}
                    className={cn(
                        "text-[10px] font-black uppercase tracking-wider rounded-md border border-border/50 px-3.5 py-2 transition-all gap-1.5 shadow-xs hover:scale-[1.01]",
                        showComparison
                            ? "bg-primary/10 text-primary font-black border-primary/20"
                            : "bg-card text-muted-foreground hover:bg-muted/10 hover:text-foreground"
                    )}
                >
                    <GitCompare className="h-3.5 w-3.5" />
                    Comparar
                </Button>
            </div>

            <div className="flex items-center space-x-2">
                <div className="flex flex-col items-end">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground mb-1 tracking-tighter">Período Actual</span>
                    <DateRangeFilter date={date} onDateChange={setDate} label="Período Actual" />
                </div>
                {showComparison && (
                    <div className="flex flex-col items-end border-l pl-4 border-muted-foreground/20">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground mb-1 tracking-tighter">Período Comparativo</span>
                        <DateRangeFilter date={compDate} onDateChange={setCompDate} label="Período Comparativo" />
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <PageContainer scrollable>
            <div className="max-w-5xl mx-auto w-full pt-4">
                <RenderToolbar />
                <FadeIn key={activeTab}>
                    <TabsContent value="bs" className="mt-0 outline-none">
                        {activeTab === "bs" && (
                            <Card className="rounded-md border bg-card/60 backdrop-blur-md shadow-xl shadow-black/5 ring-1 ring-border/50 overflow-hidden transition-all duration-300">
                                <CardContent className="p-6 md:p-10 pt-10">
                                    <ReportHeader title="Situación Financiera" dateRange={date} compDateRange={compDate} showComparison={showComparison} accent="primary" />
                                    {bsData ? (
                                        <div className="space-y-8">
                                            <div className="space-y-8">
                                                {(() => {
                                                    const d = bsData as any;
                                                    return (
                                                        <>
                                                            <ReportTable
                                                                title="Activos"
                                                                data={d.assets}
                                                                totalLabel="Total Activos"
                                                                totalValue={d.total_assets}
                                                                totalValueComp={d.total_assets_comp}
                                                                compPeriodLabel={compPeriodLabel}
                                                                periodLabel={periodLabel}
                                                                showComparison={showComparison}
                                                                accentColor="success"
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
                                                                accentColor="destructive"
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
                                                                embedded
                                                            />
                                                        </>
                                                    )
                                                })()}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="p-8">
                                            <SkeletonShell isLoading ariaLabel="Cargando..." />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="pl" className="mt-0 outline-none">
                        {activeTab === "pl" && (
                            <Card className="rounded-md border bg-card/60 backdrop-blur-md shadow-xl shadow-black/5 ring-1 ring-border/50 overflow-hidden transition-all duration-300">
                                <CardContent className="p-6 md:p-10 pt-10">
                                    <ReportHeader title="Estado de Resultados" dateRange={date} compDateRange={compDate} showComparison={showComparison} accent="success" />
                                    {plData ? (
                                        <div className="space-y-8">
                                            {(() => {
                                                const d = plData as any;
                                                return (d.sections || []).map((section: any, idx: number) => (
                                                    section.is_total ? (
                                                        <div key={idx} className={cn(
                                                            "py-6 px-4 flex justify-between items-center rounded-lg my-4 transition-colors",
                                                            idx === (d.sections?.length || 0) - 1
                                                                ? "bg-primary text-primary-foreground shadow-lg"
                                                                : "bg-muted/50 border"
                                                        )}>
                                                            <span className="text-lg font-bold uppercase tracking-tight">{section.name}</span>
                                                            <div className="flex space-x-12 items-center">
                                                                <div className="text-right">
                                                                    <div className={cn("text-[10px] uppercase font-bold opacity-70", idx === (d.sections?.length || 0) - 1 ? "text-primary-foreground" : "text-muted-foreground")}>{periodLabel || 'Actual'}</div>
                                                                    <div className="text-2xl font-black font-mono">
                                                                        <MoneyDisplay amount={section.total} digits={0} />
                                                                    </div>
                                                                </div>
                                                                {showComparison && (
                                                                    <div className={cn("text-right border-l pl-12", idx === (d.sections?.length || 0) - 1 ? "border-primary-foreground/30" : "border")}>
                                                                        <div className={cn("text-[10px] uppercase font-bold opacity-70", idx === (d.sections?.length || 0) - 1 ? "text-primary-foreground" : "text-muted-foreground")}>{compPeriodLabel || 'Anterior'}</div>
                                                                        <div className={cn("text-2xl font-black font-mono opacity-80", idx === (d.sections?.length || 0) - 1 ? "text-primary-foreground" : "")}>
                                                                            <MoneyDisplay amount={section.total_comp} digits={0} />
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
                                                            accentColor={section.name.toLowerCase().includes('ingreso') ? 'success' : section.name.toLowerCase().includes('gasto') || section.name.toLowerCase().includes('costo') ? 'destructive' : 'primary'}
                                                            embedded
                                                        />
                                                    )
                                                ))
                                            })()}
                                        </div>
                                    ) : (
                                        <div className="p-8">
                                            <SkeletonShell isLoading ariaLabel="Cargando..." />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value="cf" className="mt-0 outline-none">
                        {activeTab === "cf" && (
                            <Card className="rounded-md border bg-card/60 backdrop-blur-md shadow-xl shadow-black/5 ring-1 ring-border/50 overflow-hidden transition-all duration-300">
                                <CardContent className="p-6 md:p-10 pt-10">
                                    <ReportHeader title="Estado de Flujo de Efectivo" dateRange={date} compDateRange={compDate} showComparison={showComparison} accent="info" />
                                    {cfData ? (
                                        <CashFlowTable
                                            data={cfData as any}
                                            embedded
                                            showComparison={showComparison}
                                            periodLabel={periodLabel}
                                            compPeriodLabel={compPeriodLabel}
                                        />
                                    ) : (
                                        <div className="p-8">
                                            <SkeletonShell isLoading ariaLabel="Cargando..." />
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>
                </FadeIn>
            </div>

            <MappingConfigSheet
                open={mappingOpen}
                onOpenChange={setMappingOpen}
                mappingType={activeTab === 'pl' ? 'is' : activeTab === 'cf' ? 'cf' : 'bs'}
                onSaveSuccess={() => {
                    refetch()
                }}
            />
        </PageContainer>
    )
}
