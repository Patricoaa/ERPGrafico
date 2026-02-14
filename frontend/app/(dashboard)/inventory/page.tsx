import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Package, Truck, BarChart } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"

export default function InventoryPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Inventario"
                description="Gestión centralizada de productos, existencias y almacenes."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/inventory/products">
                    <Card className="hover:bg-accent transition-colors cursor-pointer border-l-4 border-yellow-500">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Productos</CardTitle>
                            <Package className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Maestro</div>
                            <p className="text-xs text-muted-foreground">Gestionar catálogo</p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/inventory/stock">
                    <Card className="hover:bg-accent transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Kardex</CardTitle>
                            <BarChart className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Movimientos</div>
                            <p className="text-xs text-muted-foreground">Entradas y salidas</p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/inventory/stock">
                    <Card className="hover:bg-accent transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Almacén</CardTitle>
                            <Truck className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Ubicaciones</div>
                            <p className="text-xs text-muted-foreground">Gestión física</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
