import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Banknote, Landmark, ArrowLeftRight } from "lucide-react"
import Link from "next/link"

export default function TreasuryPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <div className="flex items-center justify-between space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Tesorería</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/treasury/accounts">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-l-4 border-l-blue-600">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Cajas y Bancos</CardTitle>
                            <Banknote className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Cuentas</div>
                            <p className="text-xs text-muted-foreground">Gestión de cuentas de tesorería</p>
                        </CardContent>
                    </Card>
                </Link>

                <Link href="/treasury/payments">
                    <Card className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer border-l-4 border-l-green-600">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Pagos y Cobros</CardTitle>
                            <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Movimientos</div>
                            <p className="text-xs text-muted-foreground">Registro de caja</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
