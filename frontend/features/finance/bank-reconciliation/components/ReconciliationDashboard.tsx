"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { useReconciliation } from "../hooks/useReconciliation"
import { DashboardKPIs } from "./DashboardKPIs"
import dynamic from "next/dynamic"
import { DashboardPendingTable } from "./DashboardPendingTable"
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { LoadingFallback } from "@/components/shared/LoadingFallback"
import type { DashboardKPIData, TrendItem, DashboardPendingItem, TreasuryAccount } from "../types"

const DashboardTrendChart = dynamic(() => import("./DashboardTrendChart").then(mod => mod.DashboardTrendChart), {
    ssr: false,
    loading: () => <LoadingFallback message="Cargando gráfico..." />
})

export function ReconciliationDashboard() {
    const { fetchAccounts, fetchDashboardData, loading } = useReconciliation()
    const [stats, setStats] = useState<DashboardKPIData | null>(null)
    const [trend, setTrend] = useState<TrendItem[]>([])
    const [pending, setPending] = useState<DashboardPendingItem[]>([])
    const [accounts, setAccounts] = useState<TreasuryAccount[]>([])
    const [selectedAccount, setSelectedAccount] = useState<string>("all")

    useEffect(() => {
        loadAccounts()
    }, [])

    useEffect(() => {
        loadDashboard()
    }, [selectedAccount])

    const loadAccounts = async () => {
        const data = await fetchAccounts()
        setAccounts(data)
    }

    const loadDashboard = async () => {
        const data = await fetchDashboardData(selectedAccount)
        if (data) {
            setStats(data.stats)
            setTrend(data.trend)
            setPending(data.pending)
        }
    }

    const handleExport = async () => {
        try {
            const params: any = {}
            if (selectedAccount !== 'all') params.treasury_account = selectedAccount
            const queryString = new URLSearchParams(params).toString()
            const url = `${api.defaults.baseURL}/treasury/reconciliation-reports/export_report/?${queryString}`
            window.open(url, '_blank')
        } catch (error) {
            console.error("Export error", error)
        }
    }

    return (
        <div className="space-y-6">
            {/* Level 1: Primary Actions */}
            <div className="flex items-center justify-end px-1">
                <Button 
                    variant="outline" 
                    onClick={handleExport}
                    className="h-9 px-4 font-black uppercase tracking-widest text-[10px] border-border/60 hover:bg-muted/50 transition-all rounded-[0.25rem]"
                >
                    <Download className="mr-2 h-3.5 w-3.5" />
                    Exportar reporte consolidado
                </Button>
            </div>

            {/* Level 2: Filters & Account Selection */}
            <div className="flex items-center justify-between gap-4 px-1 pb-2 border-b border-border/10">
                <div className="flex flex-col gap-0.5">
                    <h2 className="text-xl font-black tracking-tight text-foreground/80 uppercase">Dashboard de Tesorería</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">Monitoreo de flujo y conciliación</p>
                </div>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger className="w-[240px] h-9 rounded-[0.25rem] border-border/40 font-bold uppercase text-[10px] tracking-wider">
                        <SelectValue placeholder="Todas las cuentas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-[10px] font-bold uppercase">Todas las cuentas</SelectItem>
                        {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id.toString()} className="text-[10px] font-bold uppercase">{acc.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DashboardKPIs data={stats} loading={loading} />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <DashboardTrendChart data={trend} />
                <DashboardPendingTable data={pending} loading={loading} />
            </div>
        </div>
    )
}
