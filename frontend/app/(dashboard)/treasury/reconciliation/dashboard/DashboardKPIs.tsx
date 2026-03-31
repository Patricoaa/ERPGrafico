import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react"

interface DashboardKPIsProps {
    data: any
    loading?: boolean
}

export function DashboardKPIs({ data, loading }: DashboardKPIsProps) {
    if (loading || !data) {
        return <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
                <Card key={i} className="animate-pulse">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="h-4 w-24 bg-muted rounded"></div>
                    </CardHeader>
                    <CardContent>
                        <div className="h-8 w-1/2 bg-muted rounded mb-2"></div>
                        <div className="h-2 w-full bg-muted rounded"></div>
                    </CardContent>
                </Card>
            ))}
        </div>
    }

    const { lines, reconciliation_rate, differences, statements } = data

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Tasa de Conciliación</CardTitle>
                    <CheckCircle2 className="h-4 w-4 text-emerald-700" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{reconciliation_rate}%</div>
                    <Progress value={reconciliation_rate} className="h-2 mt-2" />
                    <p className="text-xs text-muted-foreground mt-2">
                        {lines.reconciled} de {lines.total} líneas procesadas
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Pendiente Conciliar</CardTitle>
                    <Clock className="h-4 w-4 text-orange-500" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{lines.pending}</div>
                    <p className="text-xs text-muted-foreground mt-2">
                        Líneas sin reconciliar
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Diferencias</CardTitle>
                    <AlertTriangle className={`h-4 w-4 ${differences.count > 0 ? 'text-destructive' : 'text-muted-foreground'}`} />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">${differences.total_amount.toLocaleString()}</div>
                    <div className="flex gap-1 mt-2 flex-wrap">
                        {Object.entries(differences.by_type || {}).map(([type, info]: any) => (
                            <Badge key={type} variant="secondary" className="text-[10px]">
                                {info.label}: {info.count}
                            </Badge>
                        ))}
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">cartolas</CardTitle>
                    <FileText className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{statements.total}</div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                        <span>{statements.confirmed} confirmados</span>
                        <span>{statements.draft} en borrador</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
