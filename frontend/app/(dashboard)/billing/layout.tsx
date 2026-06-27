import { type Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { BillingHeader } from "./BillingHeader"

export const metadata: Metadata = {
    title: "Módulo de Facturación | ERPGrafico",
    description: "Gestión centralizada de documentos electrónicos emitidos y recibidos.",
}

export default function BillingLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <BillingHeader />
            <div className="flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
