import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { HRHeader } from "./HRHeader"

export const metadata: Metadata = {
    title: "Módulo de Recursos Humanos (RRHH) | ERPGrafico",
    description: "Gestión centralizada de personal, inasistencias, anticipos y liquidaciones.",
}

export default function HRLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer>
            <HRHeader />
            <div className="pt-2">
                {children}
            </div>
        </PageContainer>
    )
}
