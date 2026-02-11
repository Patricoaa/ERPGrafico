import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calculator, FileText, Plus, List } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"

export default function AccountingPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Módulo Contable"
                description="Administra el plan de cuentas, asientos contables y reportes financieros."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/accounting/accounts">
                    <Card className="hover:bg-accent transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Plan de Cuentas</CardTitle>
                            <List className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Cuentas</div>
                            <p className="text-xs text-muted-foreground">Administrar estructura contable</p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/accounting/entries">
                    <Card className="hover:bg-accent transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Asiento Contable</CardTitle>
                            <FileText className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Asientos</div>
                            <p className="text-xs text-muted-foreground">Ver movimientos y auditoría</p>
                        </CardContent>
                    </Card>
                </Link>
                <Link href="/accounting/periods">
                    <Card className="hover:bg-accent transition-colors cursor-pointer">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Periodos Contables</CardTitle>
                            <Calculator className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Periodos</div>
                            <p className="text-xs text-muted-foreground">Gestionar cierres mensuales</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
