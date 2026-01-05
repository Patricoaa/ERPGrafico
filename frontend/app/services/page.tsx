"use client"

import { useState, useEffect } from "react"
import api from "@/lib/api"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calendar, AlertCircle, CheckCircle, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export default function ServicesDashboard() {
    const [stats, setStats] = useState({
        pending_obs: 0,
        overdue_obs: 0,
        active_contracts: 0,
        upcoming_amount: 0
    })

    useEffect(() => {
        fetchStats()
    }, [])

    const fetchStats = async () => {
        try {
            // In a real app we'd have a specific dashboard endpoint
            // For now, we fetch lists and count manually or rely on separate calls
            const [contractsRes, obligationsRes] = await Promise.all([
                api.get('/services/contracts/?status=ACTIVE'),
                api.get('/services/obligations/?status=PENDING')
            ])

            const contracts = contractsRes.data.results || contractsRes.data
            const obligations = obligationsRes.data.results || obligationsRes.data

            const overdue = obligations.filter((o: any) => o.is_overdue).length
            const upcomingAmount = obligations.reduce((acc: number, curr: any) => acc + Number(curr.amount), 0)

            setStats({
                pending_obs: obligations.length,
                overdue_obs: overdue,
                active_contracts: contracts.length,
                upcoming_amount: upcomingAmount
            })

        } catch (error) {
            console.error("Error fetching stats:", error)
        }
    }

    return (
        <div className="p-6 space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Panel de Servicios</h1>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Contratos Activos</CardTitle>
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.active_contracts}</div>
                        <p className="text-xs text-muted-foreground">Servicios recurrentes operando</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Obligaciones Pendientes</CardTitle>
                        <Clock className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.pending_obs}</div>
                        <p className="text-xs text-muted-foreground">Pagos programados</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Vencidos</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{stats.overdue_obs}</div>
                        <p className="text-xs text-muted-foreground">Pagos atrasados</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Monto Comprometido</CardTitle>
                        <span className="text-xl font-bold">$</span>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">${stats.upcoming_amount.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground">Total en obligaciones pendientes</p>
                    </CardContent>
                </Card>
            </div>

            <div className="flex gap-4">
                <Button asChild>
                    <Link href="/services/contracts/new">Nuevo Contrato</Link>
                </Button>
                <Button variant="outline" asChild>
                    <Link href="/services/obligations">Ver Obligaciones</Link>
                </Button>
            </div>

            {/* TODO: Add Graphs and Lists */}
        </div>
    )
}
