import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { TreasuryHeader } from "./TreasuryHeader"

export const metadata: Metadata = {
    title: "Módulo de Tesorería | ERPGrafico",
    description: "Gestión centralizada de cuentas, movimientos y conciliación bancaria.",
}

export default function TreasuryLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <TreasuryHeader />
            <div className="pt-2 flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
