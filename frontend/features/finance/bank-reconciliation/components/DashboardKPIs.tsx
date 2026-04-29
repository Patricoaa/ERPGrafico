import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react"
import { cn } from "@/lib/utils"
import { CardSkeleton } from "@/components/shared"

import type { DashboardKPIData } from "../types"

interface DashboardKPIsProps {
    data: DashboardKPIData | null
    loading?: boolean
}

export function DashboardKPIs({ data, loading }: DashboardKPIsProps) {
    if (loading || !data) {
        return <CardSkeleton count={4} variant="grid" />
    }

    const { lines, reconciliation_rate, differences, statements } = data

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-black uppercase text-muted-foreground">Tasa de Conciliación</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black font-heading tracking-tighter">{reconciliation_rate}%</div>
                    <Progress value={reconciliation_rate} className="h-1.5 mt-3" />
                    <p className="text-xs font-bold text-muted-foreground mt-3 uppercase tracking-wider">
                        {lines.reconciled} de {lines.total} líneas procesadas
                    </p>
                </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-black uppercase text-muted-foreground">Pendiente Conciliar</CardTitle>
                    <Clock className="h-4 w-4 text-warning" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black font-heading tracking-tighter text-warning">{lines.pending}</div>
                    <p className="text-xs font-bold text-muted-foreground mt-3 uppercase tracking-wider">
                        Movimientos por procesar
                    </p>
                </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-black uppercase text-muted-foreground">Diferencias</CardTitle>
                    <AlertTriangle className={`h-4 w-4 ${differences.count > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                    <div className={cn(
                        "text-2xl font-black font-heading tracking-tighter",
                        differences.count > 0 ? "text-destructive" : "text-foreground"
                    )}>
                        ${differences.total_amount.toLocaleString()}
                    </div>
                    <div className="flex gap-1.5 mt-3 flex-wrap">
                        {(Object.entries(differences.by_type || {}) as [string, {label: string, count: number}][]).map(([type, info]) => (
                            <Badge 
                                key={type} 
                                variant="secondary" 
                                className="text-[10px] font-black uppercase bg-destructive/5 text-destructive border-destructive/10" // intentional: badge density
                            >
                                {info.label}: {info.count}
                            </Badge>
                        ))}
                        {differences.count === 0 && (
                            <span className="text-[10px] font-black uppercase text-success flex items-center gap-1"> {/* intentional: badge density */}
                                <CheckCircle2 className="h-2.5 w-2.5" /> Sin ajustes
                            </span>
                        )}
                    </div>
                </CardContent>
            </Card>

            <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-xs font-black uppercase text-muted-foreground">Cartolas</CardTitle>
                    <FileText className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-3xl font-black font-heading tracking-tighter">{statements.total}</div>
                    <div className="flex justify-between text-xs font-bold text-muted-foreground mt-3 uppercase tracking-wider">
                        <span className="text-success">{statements.confirmed} confirmados</span>
                        <span className="text-primary">{statements.draft} en borrador</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
