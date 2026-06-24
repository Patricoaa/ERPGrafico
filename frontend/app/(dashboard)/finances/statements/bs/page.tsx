import { PageSectionHeader } from "@/components/shared"
import { FinancialStatementsReport } from "@/features/finance"

export default async function StatementsBsPage() {
    return (
        <>
            <PageSectionHeader title="Balance General" description="Situación patrimonial y financiera" />
            <FinancialStatementsReport activeTab="bs" />
        </>)
}
