"use client"

import React, { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Download, CalendarIcon } from "lucide-react"
import api from "@/lib/api"
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

    const downloadPDF = async (type: string) => {
        // PDF implementation could be updated to support comparisons too if backend supported it, 
        // but for now keeping it simple as per original
        try {
            let url = '';
            if (type === 'balance-sheet') url = '/reports/balance-sheet/';
            if (type === 'income-statement') url = '/reports/income-statement/';

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

    const renderBSDistribution = () => {
        if (!bsData) return null;
        const total = bsData.total_assets;
        if (total === 0) return null;
        const liabPercent = (bsData.total_liabilities / total) * 100;
        const equityPercent = (bsData.total_equity / total) * 100;

        return (
            <Card className="mb-6">
                <CardContent className="pt-6">
                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span className="text-emerald-600">Activos ({bsData.total_assets.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })})</span>
                            <div className="flex space-x-4">
                                <span className="text-red-500">Pasivos ({bsData.total_liabilities.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })})</span>
                                <span className="text-blue-500">Patrimonio ({bsData.total_equity.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })})</span>
                            </div>
                        </div>
                        <div className="h-4 w-full rounded-full bg-slate-100 flex overflow-hidden">
                            <div style={{ width: `${liabPercent}%` }} className="h-full bg-red-500 transition-all" title="Pasivos" />
                            <div style={{ width: `${equityPercent}%` }} className="h-full bg-blue-500 transition-all" title="Patrimonio" />
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Distribución de Estructura de Capital</p>
                    </div>
                </CardContent>
            </Card>
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
                </div>
            </div>

            <Tabs defaultValue="bs" className="space-y-4">
                <TabsList className="grid w-full max-w-md grid-cols-3 bg-slate-100 dark:bg-slate-800">
                    <TabsTrigger value="bs">Balance</TabsTrigger>
                    <TabsTrigger value="pl">Resultados</TabsTrigger>
                    <TabsTrigger value="cf">Flujos</TabsTrigger>
                </TabsList>

                <TabsContent value="bs" className="space-y-4">
                    <div className="flex justify-end mb-2">
                        <Button variant="outline" size="sm" onClick={() => downloadPDF('balance-sheet')}>
                            <Download className="mr-2 h-4 w-4" /> PDF
                        </Button>
                    </div>

                    {bsData ? (
                        <>
                            {!showComparison && renderBSDistribution()}
                            <div className="grid gap-6">
                                <FinancialStatementTable
                                    title="Activos"
                                    data={bsData.assets}
                                    totalLabel="Total Activos"
                                    totalValue={bsData.total_assets}
                                    totalValueComp={bsData.total_assets_comp}
                                    showComparison={showComparison}
                                />
                                <FinancialStatementTable
                                    title="Pasivos"
                                    data={bsData.liabilities}
                                    totalLabel="Total Pasivos"
                                    totalValue={bsData.total_liabilities}
                                    totalValueComp={bsData.total_liabilities_comp}
                                    showComparison={showComparison}
                                />
                                <FinancialStatementTable
                                    title="Patrimonio"
                                    data={bsData.equity}
                                    totalLabel="Total Patrimonio"
                                    totalValue={bsData.total_equity}
                                    totalValueComp={bsData.total_equity_comp}
                                    showComparison={showComparison}
                                />
                                <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
                                    <CardHeader className="py-2">
                                        <CardTitle className="text-sm">Consistencia Contable (A = P + Pat)</CardTitle>
                                    </CardHeader>
                                    <CardContent className="py-2">
                                        <div className="flex justify-between items-center text-sm font-mono">
                                            <span>Diferencia Actual</span>
                                            <span className={Math.abs(bsData.check) < 1 ? "text-green-600" : "text-red-600 font-bold"}>
                                                {bsData.check.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                            </span>
                                        </div>
                                        {showComparison && (
                                            <div className="flex justify-between items-center text-sm font-mono mt-1 border-t pt-1">
                                                <span>Diferencia Comparativa</span>
                                                <span className={Math.abs(bsData.check_comp) < 1 ? "text-muted-foreground" : "text-red-400"}>
                                                    {bsData.check_comp.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                </span>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </>
                    ) : (
                        <div className="p-8 text-center">Cargando datos...</div>
                    )}
                </TabsContent>

                <TabsContent value="pl" className="space-y-4">
                    <div className="flex justify-end mb-2">
                        <Button variant="outline" size="sm" onClick={() => downloadPDF('income-statement')}>
                            <Download className="mr-2 h-4 w-4" /> PDF
                        </Button>
                    </div>
                    {plData ? (
                        <div className="space-y-6">
                            <FinancialStatementTable
                                title="Ingresos"
                                data={plData.income}
                                totalLabel="Total Ingresos"
                                totalValue={plData.total_income}
                                totalValueComp={plData.total_income_comp}
                                showComparison={showComparison}
                            />
                            <FinancialStatementTable
                                title="Gastos"
                                data={plData.expenses}
                                totalLabel="Total Gastos"
                                totalValue={plData.total_expenses}
                                totalValueComp={plData.total_expenses_comp}
                                showComparison={showComparison}
                            />
                            <Card className="bg-slate-100 dark:bg-slate-800 border-2 border-primary/20">
                                <CardHeader>
                                    <CardTitle>Resultado del Ejercicio</CardTitle>
                                    <CardDescription>Utilidad (o Pérdida) Neta después de todos los conceptos.</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex justify-around items-center">
                                        <div className="text-center">
                                            <div className="text-xs text-muted-foreground mb-1">Periodo Actual</div>
                                            <div className="text-3xl font-bold font-mono">
                                                {plData.net_income.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                            </div>
                                        </div>
                                        {showComparison && (
                                            <>
                                                <div className="text-center">
                                                    <div className="text-xs text-muted-foreground mb-1">Periodo Anterior</div>
                                                    <div className="text-2xl font-bold font-mono text-muted-foreground">
                                                        {plData.net_income_comp.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                    </div>
                                                </div>
                                                <div className="text-center">
                                                    <div className="text-xs text-muted-foreground mb-1">Variación</div>
                                                    <div className={cn("text-2xl font-bold font-mono", plData.net_income_variance > 0 ? "text-emerald-500" : "text-red-500")}>
                                                        {plData.net_income_variance.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                                                    </div>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="p-8 text-center">Cargando datos...</div>
                    )}
                </TabsContent>

                <TabsContent value="cf">
                    {cfData ? (
                        <div className="max-w-4xl mx-auto">
                            <CashFlowTable data={cfData} />
                        </div>
                    ) : (
                        <div className="p-8 text-center">Cargando datos...</div>
                    )}
                </TabsContent>
            </Tabs>
        </div>
    )
}
