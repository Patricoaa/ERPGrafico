import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { FinancesHeader } from "./FinancesHeader"

export const metadata: Metadata = {
    title: "Finanzas | ERPGrafico",
    description: "Análisis financiero, presupuestos y estados de resultados.",
}

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col">
            <FinancesHeader />
            <div className="h-full flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
