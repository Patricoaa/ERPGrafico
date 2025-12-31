"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Download, PieChart, Activity } from "lucide-react"
import api from "@/lib/api"
import { Button } from "@/components/ui/button"

export default function ReportsPage() {

    const downloadReport = async (type: 'balance-sheet' | 'income-statement') => {
        try {
            const response = await api.get(`/reports/${type}/`, {
                responseType: 'blob', // Important for PDF
            })
            
            // Create a Blob from the PDF Stream
            const file = new Blob(
              [response.data], 
              {type: 'application/pdf'}
            );
            // Build a URL from the file
            const fileURL = URL.createObjectURL(file);
            // Open string in new window or download
            const link = document.createElement('a');
            link.href = fileURL;
            link.setAttribute('download', `${type}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);

        } catch (error) {
            console.error("Error downloading report", error)
        }
    }

  return (
    <div className="flex-1 space-y-4 p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">Reportes Financieros</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        
        {/* Balance Sheet */}
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance General</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold mb-2">Situación</div>
            <p className="text-xs text-muted-foreground mb-4">Activos, Pasivos y Patrimonio</p>
            <Button onClick={() => downloadReport('balance-sheet')} className="w-full">
                <Download className="mr-2 h-4 w-4" /> Descargar PDF
            </Button>
        </CardContent>
        </Card>

        {/* Income Statement */}
        <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estado de Resultados</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold mb-2">Resultados</div>
            <p className="text-xs text-muted-foreground mb-4">Ingresos vs Gastos</p>
            <Button onClick={() => downloadReport('income-statement')} className="w-full" variant="secondary">
                <Download className="mr-2 h-4 w-4" /> Descargar PDF
            </Button>
        </CardContent>
        </Card>

      </div>
    </div>
  )
}
