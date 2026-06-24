import { PageSectionHeader } from "@/components/shared"
import { AnalysisDashboard } from "@/features/finance"

export default async function AnalysisBiPage() {
    return (
        <>
            <PageSectionHeader title="Business Intelligence" description="Analítica avanzada de datos financieros" />
            <AnalysisDashboard activeTab="bi" />
        </>)
}
