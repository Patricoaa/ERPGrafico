import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, ShoppingBag } from "lucide-react"
import Link from "next/link"

export default function PurchasingPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Módulo de Compras</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/purchasing/orders">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ordenes de Compra</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Pedidos</div>
                            <p className="text-xs text-muted-foreground">Emitir y recibir órdenes</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
