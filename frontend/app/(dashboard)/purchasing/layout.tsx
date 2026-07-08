import { type Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { PurchasingHeader } from "./PurchasingHeader"

export const metadata: Metadata = {
    title: "Módulo de Compras | ERPGrafico",
    description: "Gestión integral de órdenes de compra, notas y configuración.",
}

export default function PurchasingLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <PurchasingHeader />
            <div className="flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
