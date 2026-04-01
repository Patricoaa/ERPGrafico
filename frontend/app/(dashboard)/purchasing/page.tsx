import { IndustrialCard } from "@/components/shared/IndustrialCard"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users, FileText, ShoppingBag } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

export default function PurchasingPage() {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Módulo de Compras"
                description="Control de proveedores, órdenes de compra y adquisición de existencias."
                iconName="shopping-bag"
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/purchasing/orders">
                    <IndustrialCard variant="industrial" className="hover:bg-accent transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ordenes de Compra</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Pedidos</div>
                            <p className="text-xs text-muted-foreground">Emitir y recibir órdenes</p>
                        </CardContent>
                    </IndustrialCard>
                </Link>
            </div>
        </div>
    )
}

