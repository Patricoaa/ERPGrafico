import { PageSectionHeader } from "@/components/shared"
import { FinancialStatementsReport } from "@/features/finance"

export default async function StatementsPlPage() {
    return (
        <>
            <PageSectionHeader title="Estado de Resultados" description="Ingresos, costos y resultados del período" />
            <FinancialStatementsReport activeTab="pl" />
        </>)
}
