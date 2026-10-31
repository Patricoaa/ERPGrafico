import { type Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { ProductionHeader } from "./ProductionHeader"
import { getDomainConceptTitle } from "@/lib/entity-registry"
import { ModuleGuard } from "@/components/auth/ModuleGuard"

export const metadata: Metadata = {
    title: "Módulo de Producción | ERPGrafico",
    description: `Gestión centralizada de ${getDomainConceptTitle('ot', true).toLowerCase()}, planificación y ${getDomainConceptTitle('ldm', true).toLowerCase()}.`,
}

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
    return (
        <ModuleGuard permission="production.view_dashboard_production">
            <PageContainer className="flex flex-col">
                <ProductionHeader />
                <div className="flex-1 min-h-0 flex flex-col">
                    {children}
                </div>
            </PageContainer>
        </ModuleGuard>
    )
}
