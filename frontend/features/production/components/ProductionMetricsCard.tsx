import { useQuery } from "@tanstack/react-query"
import api from "@/lib/api"
import { Skeleton } from "@/components/shared"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Clock, Activity, Printer } from "lucide-react"
import Link from "next/link"

interface ProductionMetrics {
    avg_time_by_stage: Record<string, number>
    ots_by_stage: Record<string, number>
    overdue_ots: number
    throughput_last_30d: number
}

const fetchMetrics = async (): Promise<ProductionMetrics> => {
    const { data } = await api.get('/production/orders/metrics/')
    return data
}

export function ProductionMetricsCard() {
    const { data, isLoading, error } = useQuery({
        queryKey: ['production_metrics'],
        queryFn: fetchMetrics,
        refetchInterval: 60000, // Refresh every minute
    })

    if (isLoading) {
        return (
            <Card className="col-span-full border-border/40 shadow-sm animate-in fade-in">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Printer className="w-5 h-5 text-muted-foreground" />
                        Métricas de Producción
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-24 w-full rounded-xl" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error || !data) return null;

    return (
        <Card className="col-span-full border-border/40 shadow-sm bg-background">
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Printer className="w-5 h-5 text-primary/80" />
                    Métricas de Producción
                </CardTitle>
                <Link 
                    href="/production/orders" 
                    className="text-xs font-semibold text-primary hover:underline"
                >
                    Ver Órdenes &rarr;
                </Link>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                    {/* Active OTs */}
                    <div className="flex flex-col p-4 bg-muted/30 rounded-xl border border-border/40">
                        <div className="flex items-center gap-2 text-muted-foreground mb-2">
                            <Activity className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Activas</span>
                        </div>
                        <div className="text-2xl font-bold text-foreground">
                            {Object.values(data.ots_by_stage).reduce((a, b) => a + b, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            En piso de planta
                        </div>
                    </div>

                    {/* Overdue OTs */}
                    <Link href="/production/orders?view=list" className="flex flex-col p-4 bg-red-500/5 hover:bg-red-500/10 transition-colors rounded-xl border border-red-200 dark:border-red-900/30">
                        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-2">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Atrasadas</span>
                        </div>
                        <div className="text-2xl font-bold text-red-700 dark:text-red-300">
                            {data.overdue_ots}
                        </div>
                        <div className="text-xs text-red-600/80 dark:text-red-400/80 mt-1">
                            Requieren atención
                        </div>
                    </Link>

                    {/* Throughput */}
                    <div className="flex flex-col p-4 bg-green-500/5 rounded-xl border border-green-200 dark:border-green-900/30">
                        <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Finalizadas (30d)</span>
                        </div>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                            {data.throughput_last_30d}
                        </div>
                        <div className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                            Órdenes completadas
                        </div>
                    </div>

                    {/* Avg Time - Showing max for simplicity or a specific stage */}
                    <div className="flex flex-col p-4 bg-blue-500/5 rounded-xl border border-blue-200 dark:border-blue-900/30">
                        <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-semibold uppercase tracking-wider">Tiempos</span>
                        </div>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            {data.avg_time_by_stage['PRESS'] || 0} <span className="text-sm font-medium">días</span>
                        </div>
                        <div className="text-xs text-blue-600/80 dark:text-blue-400/80 mt-1">
                            Promedio en Prensa
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
