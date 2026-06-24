import { PageSectionHeader } from "@/components/shared"
import { FinancialStatementsReport } from "@/features/finance"

export default async function StatementsCfPage() {
    return (
        <>
            <PageSectionHeader title="Flujo de Caja" description="Movimientos de efectivo del período" />
            <FinancialStatementsReport activeTab="cf" />
        </>)
}
