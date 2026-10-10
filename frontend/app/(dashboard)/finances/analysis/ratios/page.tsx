import { PageSectionHeader } from "@/components/shared"
import { AnalysisDashboard } from "@/features/finance"

export default async function AnalysisRatiosPage() {
    return (
        <>
            <PageSectionHeader as="h1" title="Indicadores Financieros" description="Ratios de liquidez, endeudamiento y rentabilidad" />
            <AnalysisDashboard activeTab="ratios" />
        </>)
}
