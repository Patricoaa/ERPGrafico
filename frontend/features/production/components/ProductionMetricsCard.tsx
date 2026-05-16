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
                            <span className="text-xs font-black uppercase tracking-widest">Activas</span>
                        </div>
                        <div className="text-2xl font-black font-heading tracking-tighter text-foreground">
                            {Object.values(data.ots_by_stage).reduce((a, b) => a + b, 0)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            En piso de planta
                        </div>
                    </div>

                    {/* Overdue OTs */}
                    <Link href="/production/orders?view=list" className="flex flex-col p-4 bg-destructive/5 hover:bg-destructive/10 transition-colors rounded-xl border border-destructive/20">
                        <div className="flex items-center gap-2 text-destructive mb-2">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-widest">Atrasadas</span>
                        </div>
                        <div className="text-2xl font-black font-heading tracking-tighter text-destructive">
                            {data.overdue_ots}
                        </div>
                        <div className="text-xs text-destructive/70 mt-1">
                            Requieren atención
                        </div>
                    </Link>

                    {/* Throughput */}
                    <div className="flex flex-col p-4 bg-success/5 rounded-xl border border-success/20">
                        <div className="flex items-center gap-2 text-success mb-2">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-widest">Finalizadas (30d)</span>
                        </div>
                        <div className="text-2xl font-black font-heading tracking-tighter text-success">
                            {data.throughput_last_30d}
                        </div>
                        <div className="text-xs text-success/70 mt-1">
                            Órdenes completadas
                        </div>
                    </div>

                    {/* Avg Time */}
                    <div className="flex flex-col p-4 bg-info/5 rounded-xl border border-info/20">
                        <div className="flex items-center gap-2 text-info mb-2">
                            <Clock className="w-4 h-4" />
                            <span className="text-xs font-black uppercase tracking-widest">Tiempos</span>
                        </div>
                        <div className="text-2xl font-black font-heading tracking-tighter text-info">
                            {data.avg_time_by_stage['PRESS'] || 0} <span className="text-sm font-medium">días</span>
                        </div>
                        <div className="text-xs text-info/70 mt-1">
                            Promedio en Prensa
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
