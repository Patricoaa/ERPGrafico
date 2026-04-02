import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileText, Receipt, ShoppingCart, TrendingUp } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

export default function BillingPage() {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Módulo de Facturación"
                description="Gestión integral de documentos electrónicos emitidos y recibidos."
                variant="minimal"
                iconName="receipt"
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-4">
                <Link href="/billing/sales">
                    <Card className="hover:bg-accent transition-colors cursor-pointer border-l-4 border-emerald-500">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ventas (Emitidos)</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Documentos</div>
                            <p className="text-xs text-muted-foreground">Facturas, Boletas y Notas</p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/billing/purchases">
                    <Card className="hover:bg-accent transition-colors cursor-pointer border-l-4 border-blue-500">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Compras (Recibidos)</CardTitle>
                            <Receipt className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Proveedores</div>
                            <p className="text-xs text-muted-foreground">Registro de facturas recibidas</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
