import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart3, PieChart, Landmark, TrendingUp } from "lucide-react"
import Link from "next/link"

export default function FinancesPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Módulo de Finanzas</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/finances/statements">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-l-4 border-indigo-500">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Estados Financieros</CardTitle>
                            <BarChart3 className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Balances</div>
                            <p className="text-xs text-muted-foreground">Pérdidas y Ganancias, Flujos</p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/finances/analysis">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-l-4 border-violet-500">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Análisis</CardTitle>
                            <PieChart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Indicadores</div>
                            <p className="text-xs text-muted-foreground">Ratios y análisis de márgenes</p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/finances/budgets">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-l-4 border-purple-500">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Presupuestos</CardTitle>
                            <Landmark className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Planificación</div>
                            <p className="text-xs text-muted-foreground">Control presupuestario</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
