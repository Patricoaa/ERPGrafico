"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { useReconciliation } from "../hooks/useReconciliation"
import { DashboardKPIs } from "./DashboardKPIs"
import dynamic from "next/dynamic"
import { DashboardPendingTable } from "./DashboardPendingTable"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

const DashboardTrendChart = dynamic(() => import("./DashboardTrendChart").then(mod => mod.DashboardTrendChart), {
    ssr: false,
    loading: () => <div className="col-span-4 h-[350px] animate-pulse bg-muted rounded-lg" />
})

export function ReconciliationDashboard() {
    const { fetchAccounts, fetchDashboardData, loading } = useReconciliation()
    const [stats, setStats] = useState<any>(null)
    const [trend, setTrend] = useState<any[]>([])
    const [pending, setPending] = useState<any[]>([])
    const [accounts, setAccounts] = useState<any[]>([])
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
        <div className="space-y-4">
            <div className="flex items-center justify-end gap-2">
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="Todas las cuentas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas las cuentas</SelectItem>
                        {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleExport}>
                    <Download className="mr-2 h-4 w-4" />
                    Exportar Reporte
                </Button>
            </div>

            <DashboardKPIs data={stats} loading={loading} />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <DashboardTrendChart data={trend} />
                <DashboardPendingTable data={pending} />
            </div>
        </div>
    )
}
