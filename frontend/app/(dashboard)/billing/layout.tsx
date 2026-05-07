import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { BillingHeader } from "./BillingHeader"

export const metadata: Metadata = {
    title: "Módulo de Facturación | ERPGrafico",
    description: "Gestión centralizada de documentos electrónicos emitidos y recibidos.",
}

export default function BillingLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer>
            <BillingHeader />
            <div className="pt-2">
                {children}
            </div>
        </PageContainer>
    )
}
