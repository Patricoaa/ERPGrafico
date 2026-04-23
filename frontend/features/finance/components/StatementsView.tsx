"use client"

import React, { useState, useEffect } from "react"
import { TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { LAYOUT_TOKENS } from "@/lib/styles"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Download, FileText, BarChart, TrendingUp, SlidersHorizontal } from "lucide-react"
import api, { pollTask } from "@/lib/api"
import { toast } from "sonner"
import { ReportTable } from "@/components/shared/ReportTable"
import { CashFlowTable } from "@/features/finance/components/CashFlowTable"
import { MappingConfigSheet } from "@/features/finance/components/MappingConfigSheet"
import { DateRangeSelector } from "@/features/finance/components/DateRangeSelector"
import { DateRange } from "react-day-picker"
import { format, startOfYear, subYears } from "date-fns"
import { es } from 'date-fns/locale'
import { cn } from "@/lib/utils"
import { useServerDate } from "@/hooks/useServerDate"

interface StatementsViewProps {
    activeTab: string
}

export function StatementsView({ activeTab }: StatementsViewProps) {
    const [loading, setLoading] = useState(false)
    const [showComparison, setShowComparison] = useState(false)
    const [mappingOpen, setMappingOpen] = useState(false)

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

    // Data States
    const [bsData, setBsData] = useState<Record<string, unknown> | null>(null)
    const [plData, setPlData] = useState<Record<string, unknown> | null>(null)
    const [cfData, setCfData] = useState<Record<string, unknown> | null>(null)

    const loadData = async () => {
        setLoading(true)
        try {
            const params: Record<string, unknown> = {
                start_date: date?.from ? format(date.from, 'yyyy-MM-dd') : undefined,
                end_date: date?.to ? format(date.to, 'yyyy-MM-dd') : undefined,
                is_async: true
            }

            if (showComparison && compDate?.from && compDate?.to) {
                params.comp_start_date = format(compDate.from, 'yyyy-MM-dd')
                params.comp_end_date = format(compDate.to, 'yyyy-MM-dd')
            }

            const [bsRes, plRes, cfRes] = await Promise.all([
                api.get('finances/api/balance-sheet/', { params }),
                api.get('finances/api/income-statement/', { params }),
                api.get('finances/api/cash-flow/', { params })
            ])
            
            const [bs, pl, cf] = await Promise.all([
                bsRes.data.task_id ? pollTask(bsRes.data.task_id) : Promise.resolve(bsRes.data),
                plRes.data.task_id ? pollTask(plRes.data.task_id) : Promise.resolve(plRes.data),
                cfRes.data.task_id ? pollTask(cfRes.data.task_id) : Promise.resolve(cfRes.data),
            ])

            setBsData(bs)
            setPlData(pl)
            setCfData(cf)
        } catch (error) {
            console.error("Error loading finances", error)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        if (date?.from && date?.to) {
            loadData()
        }
    }, [date, showComparison, compDate])


    const getPeriodLabel = (range: DateRange | undefined) => {
        if (!range?.from || !range?.to) return ""
        const fromYear = range.from.getFullYear()
        const toYear = range.to.getFullYear()
        
        if (fromYear === toYear) {
            // Same year, check if it's the whole year
            const isFullYear = range.from.getMonth() === 0 && range.from.getDate() === 1 &&
                             range.to.getMonth() === 11 && range.to.getDate() === 31
            if (isFullYear) return `${fromYear}`
            return `${format(range.from, 'MMM', { locale: es })}-${format(range.to, 'MMM yyyy', { locale: es })}`
        }
        return `${format(range.from, 'yyyy', { locale: es })}-${format(range.to, 'yyyy', { locale: es })}`
    }

    const periodLabel = getPeriodLabel(date)
    const compPeriodLabel = getPeriodLabel(compDate)

    const ReportHeader = ({ title, dateRange }: { title: string, dateRange?: DateRange }) => (
        <div className="flex flex-col items-start text-left space-y-1 mb-8 pb-6 border-b w-full">
            <h2 className="text-2xl font-black uppercase tracking-tight text-foreground dark:text-foreground">{title}</h2>
            {dateRange?.from && dateRange?.to && (
                <p className="text-sm text-muted-foreground font-medium opacity-80">
                    Período: {format(dateRange.from, 'dd MMMM yyyy', { locale: es })} al {format(dateRange.to, 'dd MMMM yyyy', { locale: es })}
                </p>
            )}
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
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-muted/20 p-4 rounded-sm border border-dashed">
            <div className="flex items-center gap-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMappingOpen(true)}
                    className="text-[10px] font-black uppercase tracking-[0.2em] text-primary gap-1.5 hover:bg-primary/5 p-0 h-auto"
                >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Configurar Mapeo
                </Button>

                <div className="flex items-center space-x-2 border-l pl-6 border-muted-foreground/20">
                    <Switch id="compare-mode" checked={showComparison} onCheckedChange={setShowComparison} />
                    <Label htmlFor="compare-mode" className="text-[10px] font-bold uppercase tracking-widest cursor-pointer">Comparar</Label>
                </div>
            </div>

            <div className="flex items-center space-x-2">
                <div className="flex flex-col items-end">
                    <span className="text-[9px] uppercase font-bold text-muted-foreground mb-1 tracking-tighter">Período Actual</span>
                    <DateRangeSelector date={date} onDateChange={setDate} />
                </div>
                {showComparison && (
                    <div className="flex flex-col items-end border-l pl-4 border-muted-foreground/20">
                        <span className="text-[9px] uppercase font-bold text-muted-foreground mb-1 tracking-tighter">Período Comparativo</span>
                        <DateRangeSelector date={compDate} onDateChange={setCompDate} />
                    </div>
                )}
            </div>
        </div>
    )

    return (
        <div className={LAYOUT_TOKENS.view}>

            <div className="max-w-5xl mx-auto w-full pt-4">
                <TabsContent value="bs" className="mt-0 outline-none">
                    {activeTab === "bs" && (
                        <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card shadow-xl border-t-primary overflow-hidden">
                            <CardContent className="p-10 pt-10">
                                <ReportHeader title="Situación Financiera" dateRange={date} />
                                <RenderToolbar />
                                {bsData ? (
                                    <div className="space-y-10">
                                        {!showComparison && renderBSDistribution()}
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
                                                            isLoading={loading}
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
                                                            isLoading={loading}
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
                                                            isLoading={loading}
                                                            accentColor="primary"
                                                            embedded
                                                        />
                                                    </>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                ) : (
                                    <ReportTable data={null} isLoading={loading} showComparison={showComparison} />
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="pl" className="mt-0 outline-none">
                    {activeTab === "pl" && (
                        <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card shadow-xl border-t-success overflow-hidden">
                            <CardContent className="p-10 pt-10">
                                <ReportHeader title="Estado de Resultados" dateRange={date} />
                                <RenderToolbar />
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
                                                                    {(section.total || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                                </div>
                                                            </div>
                                                            {showComparison && (
                                                                <div className={cn("text-right border-l pl-12", idx === (d.sections?.length || 0) - 1 ? "border-primary-foreground/30" : "border")}>
                                                                    <div className={cn("text-[10px] uppercase font-bold opacity-70", idx === (d.sections?.length || 0) - 1 ? "text-primary-foreground" : "text-muted-foreground")}>{compPeriodLabel || 'Anterior'}</div>
                                                                    <div className={cn("text-2xl font-black font-mono opacity-80", idx === (d.sections?.length || 0) - 1 ? "text-primary-foreground" : "")}>
                                                                        {(section.total_comp || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
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
                                                        isLoading={loading}
                                                        accentColor={section.name.toLowerCase().includes('ingreso') ? 'success' : section.name.toLowerCase().includes('gasto') || section.name.toLowerCase().includes('costo') ? 'destructive' : 'primary'}
                                                        embedded
                                                    />
                                                )
                                            ))
                                        })()}
                                    </div>
                                ) : (
                                    <ReportTable data={null} isLoading={loading} showComparison={showComparison} />
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                <TabsContent value="cf" className="mt-0 outline-none">
                    {activeTab === "cf" && (
                        <Card className="rounded-none shadow-2xl ring-1 ring-border bg-card shadow-xl border-t-info overflow-hidden">
                            <CardContent className="p-10 pt-10">
                                <ReportHeader title="Estado de Flujo de Efectivo" dateRange={date} />
                                <RenderToolbar />
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
                                        <Skeleton className="h-[400px] w-full" />
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>
            </div>
            
            <MappingConfigSheet
                open={mappingOpen}
                onOpenChange={setMappingOpen}
                mappingType={activeTab === 'pl' ? 'is' : activeTab === 'cf' ? 'cf' : 'bs'}
                onSaveSuccess={loadData}
            />
        </div>
    )
}
