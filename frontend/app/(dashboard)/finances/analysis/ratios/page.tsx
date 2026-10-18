import type { Metadata } from "next"
import { AnalysisDashboard } from "@/features/finance"
import { getFinancesAnalysisSubTab } from "@/features/finances/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getFinancesAnalysisSubTab("ratios")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Ratios Financieros | ERPGrafico" }

export default async function AnalysisRatiosPage() {
  return <AnalysisDashboard activeTab="ratios" />
}