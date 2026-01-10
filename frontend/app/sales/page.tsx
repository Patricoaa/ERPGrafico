import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Users, Play } from "lucide-react"
import Link from "next/link"

export default function SalesPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Módulo de Ventas</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/sales/pos">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-l-4 border-l-primary">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Punto de Venta (POS)</CardTitle>
                            <Play className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Nueva Venta</div>
                            <p className="text-xs text-muted-foreground">Ingreso rápido de pedidos</p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/sales/history">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Historial</CardTitle>
                            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Notas de Venta</div>
                            <p className="text-xs text-muted-foreground">Ver historial y estados</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
