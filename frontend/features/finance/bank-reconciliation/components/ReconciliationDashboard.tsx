"use client"

import { useState } from "react"
import { useDashboardDataQuery, useAccountsQuery } from "../hooks/useReconciliationQueries"
import { DashboardKPIs } from "./DashboardKPIs"
import dynamic from "next/dynamic"
import { DashboardPendingTable } from "./DashboardPendingTable"
import { Select, SelectContent, SelectItem, SelectValue, SelectTrigger } from "@/components/ui/select"
import { CardSkeleton } from "@/components/shared"

const DashboardTrendChart = dynamic(() => import("./DashboardTrendChart").then(mod => mod.DashboardTrendChart), {
    ssr: false,
    loading: () => <CardSkeleton variant="grid" count={2} />
})

export function ReconciliationDashboard() {
    const [selectedAccount, setSelectedAccount] = useState<string>("all")
    
    const { data: accounts = [] } = useAccountsQuery()
    const { data: dashboardData, isLoading } = useDashboardDataQuery(selectedAccount)

    const stats = dashboardData?.stats || null
    const trend = dashboardData?.trend || []
    const pending = dashboardData?.pending || []

    return (
        <div className="space-y-6">
            {/* Level 1: Primary Actions */}


            {/* Level 2: Filters & Account Selection */}
            <div className="flex items-center justify-between gap-4 px-1 pb-2 border-b border-border/10">
                <div className="flex flex-col gap-0.5">
                    <h2 className="text-xl font-black tracking-tight text-foreground/80 uppercase">Dashboard de Tesorería</h2>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">Monitoreo de flujo y conciliación</p>
                </div>
                <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                    <SelectTrigger className="w-[240px] h-9 rounded-md border-border/40 font-bold uppercase text-xs tracking-wider">
                        <SelectValue placeholder="Todas las cuentas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-xs font-bold uppercase">Todas las cuentas</SelectItem>
                        {accounts.map(acc => (
                            <SelectItem key={acc.id} value={acc.id.toString()} className="text-xs font-bold uppercase">{acc.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <DashboardKPIs data={stats} loading={isLoading} />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <DashboardTrendChart data={trend} />
                <DashboardPendingTable data={pending} loading={isLoading} />
            </div>
        </div>
    )
}
