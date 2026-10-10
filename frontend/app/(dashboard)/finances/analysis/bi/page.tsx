import { PageSectionHeader } from "@/components/shared"
import { AnalysisDashboard } from "@/features/finance"

export default async function AnalysisBiPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Business Intelligence" description="Analítica avanzada de datos financieros" />
            <AnalysisDashboard activeTab="bi" />
        </>)
}
