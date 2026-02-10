import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Printer, ClipboardList, PenTool } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"

export default function ProductionPage() {
    return (
        <div className="flex-1 space-y-4 p-8 pt-6">
            <PageHeader
                title="Módulo de Producción"
                description="Gestión de órdenes de trabajo, planificación y control de procesos productivos."
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/production/orders">
                    <Card className="hover:bg-accent transition-colors cursor-pointer border-l-4 border-l-orange-500">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ordenes de Trabajo</CardTitle>
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Gestión OTs</div>
                            <p className="text-xs text-muted-foreground">Listado de trabajos</p>
                        </CardContent>
                    </Card>
                </Link>
                {/* Placeholder for future features */}
                <Link href="/production/orders">
                    <Card className="hover:bg-accent transition-colors cursor-pointer opacity-50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Planificación</CardTitle>
                            <Printer className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Calendario</div>
                            <p className="text-xs text-muted-foreground">Próximamente</p>
                        </CardContent>
                    </Card>
                </Link>
            </div>
        </div>
    )
}
