import { PageSectionHeader } from "@/components/shared"
import { CreditPortfolioClientView } from "@/features/credits"

export default async function CreditsHistoryPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Historial de Créditos" description="Historial de movimientos y pagos de créditos" />
            <CreditPortfolioClientView activeTab="history" />
        </>)
}
