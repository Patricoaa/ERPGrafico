import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShoppingCart, Users, Play } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"

export default function SalesPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Módulo de Ventas"
                description="Gestión integral de ventas, puntos de venta y sesiones de caja."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/sales/pos">
                    <Card className="hover:bg-accent transition-colors cursor-pointer border-l-4 border-l-primary">
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
            </div>
        </div>
    )
}
