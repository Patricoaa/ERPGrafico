import { Metadata } from "next"
import { PageContainer } from "@/components/shared"
import { FinancesHeader } from "./FinancesHeader"

export const metadata: Metadata = {
    title: "Finanzas | ERPGrafico",
    description: "Análisis financiero, presupuestos y estados de resultados.",
}

export default function FinancesLayout({ children }: { children: React.ReactNode }) {
    return (
        <PageContainer className="flex flex-col min-h-0 h-full">
            <FinancesHeader />
            <div className="pt-2 flex-1 min-h-0 flex flex-col">
                {children}
            </div>
        </PageContainer>
    )
}
