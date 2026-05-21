import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { SalesHeader } from "./SalesHeader"

export const metadata: Metadata = {
    title: "Módulo de Ventas | ERPGrafico",
    description: "Gestión integral de pedidos, terminales, cobranza y puntos de venta.",
}

export default function SalesLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <SalesHeader />
            <div className="pt-2 flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
