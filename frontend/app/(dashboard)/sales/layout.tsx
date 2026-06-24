import { type Metadata } from "next"
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
            <div className="h-full flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
