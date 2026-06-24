import { PageSectionHeader } from "@/components/shared"
import { CreditPortfolioClientView } from "@/features/credits"

export default async function CreditsHistoryPage() {
    return (
        <>
            <PageSectionHeader title="Historial de Créditos" description="Historial de movimientos y pagos de créditos" />
            <CreditPortfolioClientView activeTab="history" />
        </>)
}
