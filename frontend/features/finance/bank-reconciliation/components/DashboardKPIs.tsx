import { Progress } from "@/components/ui/progress"
import { Chip, CardSkeleton, StatCard } from "@/components/shared"
import { CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react"
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
            <StatCard
                label="Tasa de Conciliación"
                value={`${reconciliation_rate}%`}
                icon={CheckCircle2}
                subtext={`${lines.reconciled} de ${lines.total} líneas procesadas`}
                valueSize="xl"
                accent="success"
            >
                <Progress value={reconciliation_rate} className="h-1.5 mt-1" />
            </StatCard>

            <StatCard
                label="Sin Conciliar"
                value={lines.pending}
                icon={Clock}
                subtext="Movimientos por procesar"
                valueSize="xl"
                accent="warning"
                href="/treasury/reconciliation?tab=statements&filter=in_progress"
            />

            <StatCard
                label="Diferencias"
                value={`$${differences.total_amount.toLocaleString()}`}
                icon={AlertTriangle}
                accent={differences.count > 0 ? "destructive" : "muted"}
            >
                <div className="flex gap-1.5 mt-3 flex-wrap">
                    {(Object.entries(differences.by_type || {}) as [string, {label: string, count: number}][]).map(([type, info]) => (
                        <Chip
                            key={type}
                            size="xs"
                            intent="destructive"
                            className="bg-destructive/5 border-destructive/10"
                        >
                            {info.label}: {info.count}
                        </Chip>
                    ))}
                    {differences.count === 0 && (
                        <span className="text-[10px] font-black uppercase text-success flex items-center gap-1">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Sin ajustes
                        </span>
                    )}
                </div>
            </StatCard>

            <StatCard
                label="Cartolas"
                value={statements.total}
                icon={FileText}
                valueSize="xl"
                accent="primary"
                href="/treasury/reconciliation?tab=statements"
            >
                <div className="flex justify-between text-xs font-bold text-muted-foreground mt-2 uppercase tracking-wider">
                    <span className="text-success">{statements.confirmed} confirmados</span>
                    <span className="text-primary">{statements.draft} en borrador</span>
                </div>
            </StatCard>
        </div>
    )
}

