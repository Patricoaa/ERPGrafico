import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { ProductionHeader } from "./ProductionHeader"

export const metadata: Metadata = {
    title: "Módulo de Producción | ERPGrafico",
    description: "Gestión centralizada de órdenes de trabajo, planificación y listas de materiales.",
}

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer>
            <ProductionHeader />
            <div className="pt-2">
                {children}
            </div>
        </PageContainer>
    )
}
