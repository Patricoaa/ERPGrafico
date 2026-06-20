"use client"

import { Skeleton, StatCard } from "@/components/shared"
import {useProductionMetrics} from "../hooks/useProductionQueries"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle, CheckCircle2, Clock, Activity, Printer } from "lucide-react"
import Link from "next/link"

export function ProductionMetricsCard() {
    const { data, isLoading, error } = useProductionMetrics()

    if (isLoading) {
        return (
            <Card className="col-span-full border-border/40 shadow-card animate-in fade-in">
                <CardHeader className="pb-2">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                        <Printer className="w-5 h-5 text-muted-foreground" />
                        Métricas de Producción
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mt-2">
                        {[1, 2, 3, 4].map(i => (
                            <Skeleton key={i} className="h-24 w-full rounded-md" />
                        ))}
                    </div>
                </CardContent>
            </Card>
        )
    }

    if (error || !data) return null;

    return (
        <Card className="col-span-full border-border/40 shadow-card bg-background">
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
                    <StatCard
                        label="Activas"
                        value={Object.values(data.ots_by_stage).reduce((a, b) => a + b, 0)}
                        icon={Activity}
                        subtext="En piso de planta"
                        variant="minimal"
                        accent="muted"
                        className="p-4 flex-col"
                    />
                    <StatCard
                        label="Atrasadas"
                        value={data.overdue_ots}
                        icon={AlertCircle}
                        subtext="Requieren atención"
                        variant="minimal"
                        accent="destructive"
                        className="p-4 flex-col hover:bg-destructive/10 transition-colors"
                        href="/production/orders?view=list"
                    />
                    <StatCard
                        label="Finalizadas (30d)"
                        value={data.throughput_last_30d}
                        icon={CheckCircle2}
                        subtext="Órdenes completadas"
                        variant="minimal"
                        accent="success"
                        className="p-4 flex-col"
                    />
                    <StatCard
                        label="Tiempos"
                        value={<>{data.avg_time_by_stage['PRESS'] || 0} <span className="text-sm font-medium">días</span></>}
                        icon={Clock}
                        subtext="Promedio en Prensa"
                        variant="minimal"
                        accent="info"
                        className="p-4 flex-col"
                    />
                </div>
            </CardContent>
        </Card>
    )
}
