"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    TrendingUp, TrendingDown, Activity, AlertCircle, Calendar,
    ArrowLeft, CheckCircle2, AlertTriangle, FileText
} from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    LineChart, Line, Legend
} from 'recharts'
import { format, subMonths } from "date-fns"
import { es } from "date-fns/locale"
import api from "@/lib/api"

interface DashboardMetrics {
    period: { from: string, to: string }
    statements: { total: number, confirmed: number, draft: number }
    lines: { total: number, reconciled: number, matched: number, pending: number, excluded: number }
    reconciliation_rate: number
    differences: {
        total_amount: number
        count: number
        average: number
        by_type: Record<string, { label: string, count: number, total: number }>
    }
}

interface TrendData {
    month: string
    reconciliation_rate: number
    total_lines: number
    reconciled_lines: number
}

interface PendingItem {
    id: number
    statement: string
    account: string
    date: string
    description: string
    amount: number
    days_pending: number
    is_overdue: boolean
}

interface Account {
    id: number
    name: string
}

export default function ReconciliationDashboard() {
    const router = useRouter()
    const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
    const [trend, setTrend] = useState<TrendData[]>([])
    const [pending, setPending] = useState<PendingItem[]>([])
    const [accounts, setAccounts] = useState<Account[]>([])
    const [selectedAccount, setSelectedAccount] = useState<string>("all")
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchAccounts()
        fetchData()
    }, [])

    useEffect(() => {
        fetchData()
    }, [selectedAccount])

    const fetchAccounts = async () => {
        try {
            const response = await api.get('/treasury/accounts/')
            setAccounts(response.data)
        } catch (error) {
            console.error('Error fetching accounts:', error)
        }
    }

    const fetchData = async () => {
        setLoading(true)
        try {
            const params = selectedAccount !== 'all' ? { treasury_account: selectedAccount } : {}

            const [dashboardRes, trendRes, pendingRes] = await Promise.all([
                api.get('/treasury/reconciliation-reports/dashboard/', { params }),
                api.get('/treasury/reconciliation-reports/history/', { params: { ...params, months: 6 } }),
                api.get('/treasury/reconciliation-reports/pending/', { params })
            ])

            setMetrics(dashboardRes.data)
            setTrend(trendRes.data)
            setPending(pendingRes.data)
        } catch (error) {
            console.error('Error fetching dashboard data:', error)
        } finally {
            setLoading(false)
        }
    }

    if (loading) {
        return <div className="p-8 text-center text-gray-500">Cargando dashboard...</div>
    }

    if (!metrics) return null

    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Dashboard de Reconciliación</h2>
                    <p className="text-muted-foreground">Vista general del estado de conciliaciones</p>
                </div>
                <div className="flex items-center gap-4">
                    <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                        <SelectTrigger className="w-[250px]">
                            <SelectValue placeholder="Todas las cuentas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas las cuentas</SelectItem>
                            {accounts.map(acc => (
                                <SelectItem key={acc.id} value={acc.id.toString()}>{acc.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => router.push('/treasury/reconciliation')}>
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Button>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tasa de Reconciliación</CardTitle>
                        <Activity className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics.reconciliation_rate}%</div>
                        <p className="text-xs text-muted-foreground">
                            {metrics.lines.reconciled} de {metrics.lines.total} líneas
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Pendientes de Conciliar</CardTitle>
                        <AlertCircle className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                            {metrics.lines.pending}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {metrics.lines.matched} en estado de match
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Extractos Confirmados</CardTitle>
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                            {metrics.statements.confirmed}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            de {metrics.statements.total} totales
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Diferencias Totales</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-600 font-mono">
                            ${Math.abs(metrics.differences.total_amount).toLocaleString('es-CL')}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            En {metrics.differences.count} transacciones
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                {/* Trend Chart */}
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Tendencia Mensual</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={trend}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={12}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    fontSize={12}
                                    tickFormatter={(value) => `${value}`}
                                />
                                <Tooltip />
                                <Bar dataKey="total_lines" name="Total Líneas" stackId="a" fill="#e5e7eb" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="reconciled_lines" name="Reconciliadas" stackId="a" fill="#2563eb" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Differences Analysis */}
                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Análisis de Diferencias</CardTitle>
                        <CardDescription>Principales causas de ajuste</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {Object.entries(metrics.differences.by_type).map(([key, data]) => (
                                <div key={key} className="flex items-center">
                                    <div className="w-full space-y-1">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-medium leading-none">
                                                {data.label}
                                            </p>
                                            <span className="text-sm font-mono text-muted-foreground">
                                                ${Math.abs(data.total).toLocaleString('es-CL')}
                                            </span>
                                        </div>
                                        <div className="h-2 w-full rounded-full bg-secondary">
                                            <div
                                                className="h-2 rounded-full bg-primary"
                                                style={{
                                                    width: `${(data.total / Math.max(metrics.differences.total_amount, 1)) * 100}%`
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Pending Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Pendientes Prioritarios</CardTitle>
                    <CardDescription>
                        Transacciones sin reconciliar con más antigüedad
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {pending.length === 0 ? (
                            <p className="text-center text-muted-foreground py-8">
                                No hay pendientes prioritarios
                            </p>
                        ) : (
                            pending.slice(0, 5).map(item => (
                                <div key={item.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                                    <div className="flex items-start gap-4">
                                        <div className={`p-2 rounded-full ${item.is_overdue ? 'bg-red-100' : 'bg-gray-100'}`}>
                                            <AlertTriangle className={`h-4 w-4 ${item.is_overdue ? 'text-red-600' : 'text-gray-500'}`} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm">{item.description}</p>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <span>{item.account}</span>
                                                <span>•</span>
                                                <span>{format(new Date(item.date), 'dd MMM yyyy', { locale: es })}</span>
                                                <span>•</span>
                                                <span className={item.days_pending > 15 ? 'text-red-600 font-bold' : ''}>
                                                    Hace {item.days_pending} días
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-mono font-bold text-sm">
                                            ${item.amount.toLocaleString('es-CL')}
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="text-xs h-6 mt-1"
                                            onClick={() => router.push(`/treasury/reconciliation/${item.id}/match`)}
                                        >
                                            Resolver
                                        </Button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
