"use client"

import React, { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, RefreshCw } from "lucide-react"
import api from "@/lib/api"
import { FinancialStatementTable } from "@/components/reports/FinancialStatementTable"
import { CashFlowTable } from "@/components/reports/CashFlowTable"
import { AnalysisDashboard } from "@/components/reports/AnalysisDashboard"
import { BudgetManager } from "@/components/reports/BudgetManager"

export default function ReportsPage() {
  const [loading, setLoading] = useState(false);

  // Data States
  const [bsData, setBsData] = useState<any>(null);
  const [plData, setPlData] = useState<any>(null);
  const [cfData, setCfData] = useState<any>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [bs, pl, cf] = await Promise.all([
        api.get('/reports/api/balance-sheet/'),
        api.get('/reports/api/income-statement/'),
        api.get('/reports/api/cash-flow/')
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
    loadData();
  }, []);

  const downloadPDF = async (type: string) => {
    try {
      // Use legacy endpoint for PDF
      let url = '';
      if (type === 'balance-sheet') url = '/reports/balance-sheet/';
      if (type === 'income-statement') url = '/reports/income-statement/';
      // Cash flow PDF not yet implemented in backend Views

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

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Reportes Financieros</h2>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="statements" className="space-y-4">
        <TabsList>
          <TabsTrigger value="statements">Estados Financieros</TabsTrigger>
          <TabsTrigger value="analysis">Análisis Financiero</TabsTrigger>
          <TabsTrigger value="budgets">Presupuestos</TabsTrigger>
        </TabsList>

        <TabsContent value="statements" className="space-y-4">
          <Tabs defaultValue="bs">
            <div className="flex space-x-2 mb-4">
              <TabsList className="bg-slate-100 dark:bg-slate-800">
                <TabsTrigger value="bs">Balance General</TabsTrigger>
                <TabsTrigger value="pl">Estado de Resultados</TabsTrigger>
                <TabsTrigger value="cf">Flujo de Efectivo</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="bs">
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" onClick={() => downloadPDF('balance-sheet')}>
                  <Download className="mr-2 h-4 w-4" /> PDF
                </Button>
              </div>
              {bsData ? (
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
              ) : (
                <div className="p-8 text-center">Cargando datos...</div>
              )}
            </TabsContent>

            <TabsContent value="pl">
              <div className="flex justify-end mb-2">
                <Button variant="outline" size="sm" onClick={() => downloadPDF('income-statement')}>
                  <Download className="mr-2 h-4 w-4" /> PDF
                </Button>
              </div>
              {plData ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <FinancialStatementTable
                    title="Ingresos"
                    data={plData.income}
                    totalLabel="Total Ingresos"
                    totalValue={plData.total_income}
                  />
                  <div className="space-y-4">
                    <FinancialStatementTable
                      title="Gastos"
                      data={plData.expenses}
                      totalLabel="Total Gastos"
                      totalValue={plData.total_expenses}
                    />
                    <Card className="bg-slate-100 dark:bg-slate-800">
                      <CardHeader>
                        <CardTitle>Resultado del Ejercicio</CardTitle>
                        <CardDescription>Utilidad (o Pérdida) Neta</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold font-mono">
                          {plData.net_income.toLocaleString('es-CL', { style: 'currency', currency: 'CLP' })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
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
        </TabsContent>

        <TabsContent value="analysis">
          <AnalysisDashboard />
        </TabsContent>

        <TabsContent value="budgets">
          <BudgetManager />
        </TabsContent>

      </Tabs>
    </div>
  )
}
