import { IndustrialCard } from "@/components/shared/IndustrialCard"
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Printer, ClipboardList, PenTool } from "lucide-react"
import Link from "next/link"
import { PageHeader } from "@/components/shared/PageHeader"
import { LAYOUT_TOKENS } from "@/lib/styles"

export default function ProductionPage() {
    return (
        <div className={LAYOUT_TOKENS.view}>
            <PageHeader
                title="Módulo de Producción"
                description="Gestión de órdenes de trabajo, planificación y control de procesos productivos."
                iconName="pen-tool"
            />
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Link href="/production/orders">
                    <IndustrialCard variant="industrial" className="hover:bg-accent transition-colors cursor-pointer border-t-orange-500">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Ordenes de Trabajo</CardTitle>
                            <ClipboardList className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Gestión OTs</div>
                            <p className="text-xs text-muted-foreground">Listado de trabajos</p>
                        </CardContent>
                    </IndustrialCard>
                </Link>
                {/* Placeholder for future features */}
                <Link href="/production/orders">
                    <IndustrialCard variant="industrial" className="hover:bg-accent transition-colors cursor-pointer opacity-50">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Planificación</CardTitle>
                            <Printer className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold">Calendario</div>
                            <p className="text-xs text-muted-foreground">Próximamente</p>
                        </CardContent>
                    </IndustrialCard>
                </Link>
            </div>
        </div>
    )
}
