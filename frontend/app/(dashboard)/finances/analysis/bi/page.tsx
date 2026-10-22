import type { Metadata } from "next"
import { AnalysisDashboard } from "@/features/finance"
import { getFinancesAnalysisSubTab } from "@/features/finances/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getFinancesAnalysisSubTab("bi")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Business Intelligence | ERPGrafico" }

export default async function AnalysisBiPage() {
  return <AnalysisDashboard activeTab="bi" />
}