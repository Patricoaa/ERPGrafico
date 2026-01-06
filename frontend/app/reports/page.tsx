"use client"

import React, { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import api from "@/lib/api"
import { FinancialStatementTable } from "@/components/reports/FinancialStatementTable"
import { CashFlowTable } from "@/components/reports/CashFlowTable"
import { AnalysisDashboard } from "@/components/reports/AnalysisDashboard"
import { BudgetManager } from "@/components/reports/BudgetManager"
import { DateRangeSelector } from "@/components/reports/DateRangeSelector"
import { DateRange } from "react-day-picker"
import { addDays, format, startOfYear } from "date-fns"

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);

  // Date State
  const [date, setDate] = useState<DateRange | undefined>({
    from: startOfYear(new Date()),
    to: new Date(),
  })

  // Data States
  const [bsData, setBsData] = useState<any>(null);
  const [plData, setPlData] = useState<any>(null);
  const [cfData, setCfData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const params = {
        start_date: date?.from ? format(date.from, 'yyyy-MM-dd') : undefined,
        end_date: date?.to ? format(date.to, 'yyyy-MM-dd') : undefined,
      };

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
  }, [date]); // Reload when date changes

  const downloadPDF = async (type: string) => {
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

  // Balance Sheet Distribution Chart
  const renderBSDistribution = () => {
    if (!bsData) return null;
    const total = bsData.total_assets; // Assuming Assets = Liab + Equity approximately
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

            {/* Visual Bar */}
            <div className="h-4 w-full rounded-full bg-slate-100 flex overflow-hidden">
              {/* We visualize Liabilities and Equity filling up the "Assets" bar since A = L + E */}
              <div
                style={{ width: `${liabPercent}%` }}
                className="h-full bg-red-500 transition-all"
                title="Pasivos"
              />
              <div
                style={{ width: `${equityPercent}%` }}
                className="h-full bg-blue-500 transition-all"
                title="Patrimonio"
              />
              {/* Remaining space/difference handled by flex container if A != L+E slightly */}
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Distribución de Estructura de Capital
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Reportes Financieros</h2>
        <div className="flex items-center space-x-2">
          <DateRangeSelector date={date} onDateChange={setDate} />
        </div>
      </div>

      <Tabs defaultValue="bs" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 bg-slate-100 dark:bg-slate-800">
          <TabsTrigger value="bs">Balance General</TabsTrigger>
          <TabsTrigger value="pl">Estado de Resultados</TabsTrigger>
          <TabsTrigger value="cf">Flujo de Efectivo</TabsTrigger>
          <TabsTrigger value="analysis">Análisis</TabsTrigger>
          <TabsTrigger value="budgets">Presupuestos</TabsTrigger>
        </TabsList>

        {/* Balance Sheet */}
        <TabsContent value="bs" className="space-y-4">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={() => downloadPDF('balance-sheet')}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>

          {bsData ? (
            <>
              {renderBSDistribution()}

              <div className="grid gap-4 md:grid-cols-2">
                <FinancialStatementTable
                  title="Activos"
                  data={bsData.assets}
                  totalLabel="Total Activos"
                  totalValue={bsData.total_assets}
                />
                <div className="space-y-4">
                  <FinancialStatementTable
                    title="Pasivos"
                    data={bsData.liabilities}
                    totalLabel="Total Pasivos"
                    totalValue={bsData.total_liabilities}
                  />
                  <FinancialStatementTable
                    title="Patrimonio"
                    data={bsData.equity}
                    totalLabel="Total Patrimonio"
                    totalValue={bsData.total_equity}
                  />
                  <Card className="bg-slate-50 dark:bg-slate-900 border-dashed">
                    <CardHeader className="py-2">
                      <CardTitle className="text-sm">Ecuación Contable</CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="flex justify-between items-center text-sm font-mono">
                        <span>Activos = Pasivos + Patrimonio</span>
                        <span className={Math.abs(bsData.check) < 1 ? "text-green-600" : "text-red-600 font-bold"}>
                          Dif: {bsData.check.toFixed(2)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </>
          ) : (
            <div className="p-8 text-center">Cargando datos...</div>
          )}
        </TabsContent>

        {/* Income Statement */}
        <TabsContent value="pl" className="space-y-4">
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" onClick={() => downloadPDF('income-statement')}>
              <Download className="mr-2 h-4 w-4" /> PDF
            </Button>
          </div>
          {plData ? (
            <div className="max-w-4xl mx-auto space-y-6">
              {/* Single Column Layout */}
              <FinancialStatementTable
                title="Ingresos"
                data={plData.income}
                totalLabel="Total Ingresos"
                totalValue={plData.total_income}
              />

              <div className="relative">
                {/* Visual separator */}
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-dashed" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">Menos</span>
                </div>
              </div>

              <FinancialStatementTable
                title="Gastos"
                data={plData.expenses}
                totalLabel="Total Gastos"
                totalValue={plData.total_expenses}
              />

              <Card className="bg-slate-100 dark:bg-slate-800 border-2 border-primary/20">
                <CardHeader>
                  <CardTitle>Resultado del Ejercicio</CardTitle>
                  <CardDescription>Utilidad (o Pérdida) Neta</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold font-mono text-center">
                    {plData.net_income.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="p-8 text-center">Cargando datos...</div>
          )}
        </TabsContent>

        {/* Cash Flow */}
        <TabsContent value="cf">
          {cfData ? (
            <div className="max-w-4xl mx-auto">
              <CashFlowTable data={cfData} />
            </div>
          ) : (
            <div className="p-8 text-center">Cargando datos...</div>
          )}
        </TabsContent>

        {/* Analysis */}
        <TabsContent value="analysis">
          <AnalysisDashboard />
        </TabsContent>

        {/* Budgets */}
        <TabsContent value="budgets">
          <BudgetManager />
        </TabsContent>

      </Tabs>
    </div>
  )
}
