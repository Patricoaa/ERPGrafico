"use client"

import React, { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Download, CalendarIcon } from "lucide-react"
import api from "@/lib/api"
import { toast } from "sonner"
import { FinancialStatementTable } from "@/components/reports/FinancialStatementTable"
import { CashFlowTable } from "@/components/reports/CashFlowTable"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { DateRange } from "react-day-picker"
import { format, startOfYear, subMonths, subYears, startOfMonth, endOfMonth } from "date-fns"
import { es } from 'date-fns/locale'
import { cn } from "@/lib/utils"

export default function StatementsPage() {
    const [loading, setLoading] = useState(false);
    const [showComparison, setShowComparison] = useState(false);
    const [periodType, setPeriodType] = useState<'annual' | 'monthly'>('annual');
    const [activeTab, setActiveTab] = useState('bs');

    // Date State
    const [date, setDate] = useState<DateRange | undefined>({
        from: startOfYear(new Date()),
        to: new Date(),
    })

    const [compDate, setCompDate] = useState<DateRange | undefined>({
        from: startOfYear(subYears(new Date(), 1)),
        to: subYears(new Date(), 1),
    })

    // Data States
    const [bsData, setBsData] = useState<any>(null);
    const [plData, setPlData] = useState<any>(null);
    const [cfData, setCfData] = useState<any>(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const params: any = {
                start_date: date?.from ? format(date.from, 'yyyy-MM-dd') : undefined,
                end_date: date?.to ? format(date.to, 'yyyy-MM-dd') : undefined,
            };

            if (showComparison && compDate?.from && compDate?.to) {
                params.comp_start_date = format(compDate.from, 'yyyy-MM-dd');
                params.comp_end_date = format(compDate.to, 'yyyy-MM-dd');
            }

            const [bs, pl, cf] = await Promise.all([
                api.get('/reports/api/balance-sheet/', { params }),
                api.get('/reports/api/income-statement/', { params }),
                api.get('/reports/api/cash-flow/', { params })
            ]);

            setBsData(bs.data);
            setPlData(pl.data);
            setCfData(cf.data);
        } catch (error) {
            console.error("Error loading reports", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (date?.from && date?.to) {
            loadData();
        }
    }, [date, showComparison, compDate]);

    const togglePeriod = (type: 'annual' | 'monthly') => {
        setPeriodType(type);
        if (type === 'monthly') {
            const start = startOfMonth(new Date());
            const end = endOfMonth(new Date());
            setDate({ from: start, to: end });
            setCompDate({ from: startOfMonth(subMonths(start, 1)), to: endOfMonth(subMonths(start, 1)) });
        } else {
            const start = startOfYear(new Date());
            setDate({ from: start, to: new Date() });
            setCompDate({ from: startOfYear(subYears(start, 1)), to: subYears(new Date(), 1) });
        }
    };

    const downloadPDF = async () => {
        const type = activeTab === 'bs' ? 'balance-sheet' : 'income-statement';
        if (activeTab === 'cf') {
            toast.error("Descarga PDF para Flujo de Caja no implementada aún.");
            return;
        }
        try {
            let url = '';
            if (type === 'balance-sheet') url = '/reports/balance-sheet/';
            if (type === 'income-statement') url = '/reports/income-statement/';
            // ...

            if (url) {
                const response = await api.get(url, { responseType: 'blob' });
                const file = new Blob([response.data], { type: 'application/pdf' });
                const fileURL = URL.createObjectURL(file);
                const link = document.createElement('a');
                link.href = fileURL;
                link.setAttribute('download', `${type}.pdf`);
                document.body.appendChild(link);
                link.click();
                link.parentNode?.removeChild(link);
            }
        } catch (error) {
            console.error("Error downloading report", error)
        }
    };

    const ReportHeader = ({ title, dateRange }: { title: string, dateRange?: DateRange }) => (
        <div className="flex flex-col items-center text-center space-y-1 mb-8 pb-6 border-b">

            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{title}</h2>
            {dateRange?.from && dateRange?.to && (
                <p className="text-sm text-muted-foreground font-medium">
                    Período: {format(dateRange.from, 'dd MMMM yyyy', { locale: es })} al {format(dateRange.to, 'dd MMMM yyyy', { locale: es })}
                </p>
            )}
            <div className="w-16 h-1 bg-primary mt-4 rounded-full" />
        </div>
    );

    const renderBSDistribution = () => {
        if (!bsData) return null;
        const a = bsData.total_assets || 0;
        const p = bsData.total_liabilities || 0;
        const e = bsData.total_equity || 0;
        const totalSum = a + p + e;
        if (totalSum === 0) return null;

        const aP = (a / totalSum) * 100;
        const pP = (p / totalSum) * 100;
        const eP = (e / totalSum) * 100;

        const fmt = (val: number) => val.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 });

        return (
            <div className="mb-10 overflow-hidden rounded-lg border shadow-sm">
                <div className="h-10 w-full flex text-[10px] font-bold text-white uppercase tracking-tighter">
                    <div
                        style={{ width: `${aP}%` }}
                        className="bg-emerald-500 flex items-center justify-center p-1 transition-all border-r border-white/20 whitespace-nowrap overflow-hidden"
                        title={`Activos: ${fmt(a)}`}
                    >
                        Activos: {fmt(a)}
                    </div>
                    <div
                        style={{ width: `${pP}%` }}
                        className="bg-red-500 flex items-center justify-center p-1 transition-all border-r border-white/20 whitespace-nowrap overflow-hidden"
                        title={`Pasivos: ${fmt(p)}`}
                    >
                        Pasivos: {fmt(p)}
                    </div>
                    <div
                        style={{ width: `${eP}%` }}
                        className="bg-blue-600 flex items-center justify-center p-1 transition-all whitespace-nowrap overflow-hidden"
                        title={`Patrimonio: ${fmt(e)}`}
                    >
                        Patrimonio: {fmt(e)}
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Estados Financieros</h2>
                    <p className="text-muted-foreground">Consulta el balance, resultados y flujos de tu empresa.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center space-x-2 bg-slate-100 p-1 rounded-lg">
                        <Button
                            variant={periodType === 'annual' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => togglePeriod('annual')}
                            className="text-xs h-8"
                        >
                            Anual
                        </Button>
                        <Button
                            variant={periodType === 'monthly' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => togglePeriod('monthly')}
                            className="text-xs h-8"
                        >
                            Mensual
                        </Button>
                    </div>

                    <div className="flex items-center space-x-2 border-l pl-4">
                        <Switch id="compare-mode" checked={showComparison} onCheckedChange={setShowComparison} />
                        <Label htmlFor="compare-mode" className="text-sm cursor-pointer">Comparar</Label>
                    </div>

                    <div className="flex items-center space-x-2">
                        <DateRangeSelector date={date} onDateChange={setDate} />
                        {showComparison && (
                            <div className="flex items-center space-x-2 border-l pl-4">
                                <span className="text-xs text-muted-foreground">vs</span>
                                <DateRangeSelector date={compDate} onDateChange={setCompDate} />
                            </div>
                        )}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => downloadPDF()} className="h-10 px-4 whitespace-nowrap">
                        <Download className="mr-2 h-4 w-4" /> Exportar PDF
                    </Button>
                </div>
            </div>

            <Tabs
                defaultValue="bs"
                onValueChange={setActiveTab}
                className="space-y-4"
            >
                <div className="flex justify-center">
                    <TabsList className="grid w-full max-sm:max-w-xs max-w-sm grid-cols-3 bg-slate-100 dark:bg-slate-800 rounded-full h-11 p-1">
                        <TabsTrigger value="bs" className="rounded-full">Balance</TabsTrigger>
                        <TabsTrigger value="pl" className="rounded-full">Resultados</TabsTrigger>
                        <TabsTrigger value="cf" className="rounded-full">Flujos</TabsTrigger>
                    </TabsList>
                </div>

                <div className="max-w-5xl mx-auto w-full pt-4">
                    <TabsContent value="bs">
                        <Card className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800">
                            <CardContent className="p-10">
                                <ReportHeader title="Balance General" dateRange={date} />
                                {bsData ? (
                                    <div className="space-y-10">
                                        {!showComparison && renderBSDistribution()}
                                        <div className="grid gap-12">
                                            <FinancialStatementTable
                                                title="Activos"
                                                data={bsData.assets}
                                                totalLabel="Total Activos"
                                                totalValue={bsData.total_assets}
                                                totalValueComp={bsData.total_assets_comp}
                                                showComparison={showComparison}
                                                embedded
                                            />
                                            <FinancialStatementTable
                                                title="Pasivos"
                                                data={bsData.liabilities}
                                                totalLabel="Total Pasivos"
                                                totalValue={bsData.total_liabilities}
                                                totalValueComp={bsData.total_liabilities_comp}
                                                showComparison={showComparison}
                                                embedded
                                            />
                                            <FinancialStatementTable
                                                title="Patrimonio"
                                                data={bsData.equity}
                                                totalLabel="Total Patrimonio"
                                                totalValue={bsData.total_equity}
                                                totalValueComp={bsData.total_equity_comp}
                                                showComparison={showComparison}
                                                embedded
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="p-8 text-center animate-pulse">Cargando datos del balance...</div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="pl">
                        <Card className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800">
                            <CardContent className="p-10">
                                <ReportHeader title="Estado de Resultados" dateRange={date} />
                                {plData ? (
                                    <div className="space-y-8">
                                        {(plData.sections || []).map((section: any, idx: number) => (
                                            section.is_total ? (
                                                <div key={idx} className={cn(
                                                    "py-6 px-4 flex justify-between items-center rounded-lg my-4 transition-colors",
                                                    idx === (plData.sections?.length || 0) - 1
                                                        ? "bg-primary text-primary-foreground shadow-lg"
                                                        : "bg-slate-50 dark:bg-slate-900 border"
                                                )}>
                                                    <span className="text-lg font-bold uppercase tracking-tight">{section.name}</span>
                                                    <div className="flex space-x-12 items-center">
                                                        <div className="text-right">
                                                            <div className={cn("text-[10px] uppercase font-bold opacity-70", idx === (plData.sections?.length || 0) - 1 ? "text-primary-foreground" : "text-muted-foreground")}>Actual</div>
                                                            <div className="text-2xl font-black font-mono">
                                                                {(section.total || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                            </div>
                                                        </div>
                                                        {showComparison && (
                                                            <div className={cn("text-right border-l pl-12", idx === (plData.sections?.length || 0) - 1 ? "border-primary-foreground/30" : "border-slate-300")}>
                                                                <div className={cn("text-[10px] uppercase font-bold opacity-70", idx === (plData.sections?.length || 0) - 1 ? "text-primary-foreground" : "text-muted-foreground")}>Anterior</div>
                                                                <div className={cn("text-2xl font-black font-mono opacity-80", idx === (plData.sections?.length || 0) - 1 ? "text-primary-foreground" : "")}>
                                                                    {(section.total_comp || 0).toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ) : (
                                                <FinancialStatementTable
                                                    key={idx}
                                                    title={section.name}
                                                    data={section.tree}
                                                    totalLabel={`Total ${section.name}`}
                                                    totalValue={section.total}
                                                    totalValueComp={section.total_comp}
                                                    showComparison={showComparison}
                                                    embedded
                                                />
                                            )
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center animate-pulse">Cargando estado de resultados...</div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value="cf">
                        <Card className="shadow-xl border-none ring-1 ring-slate-200 dark:ring-slate-800">
                            <CardContent className="p-10">
                                <ReportHeader title="Estado de Flujo de Efectivo" dateRange={date} />
                                {cfData ? (
                                    <CashFlowTable data={cfData} embedded />
                                ) : (
                                    <div className="p-8 text-center animate-pulse">Cargando flujo de caja...</div>
                                )}
                            </CardContent>
                        </Card>
                    </TabsContent>
                </div>
            </Tabs>
        </div>
    )
}
