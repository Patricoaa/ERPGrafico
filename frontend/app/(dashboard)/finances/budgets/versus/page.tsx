import type { Metadata } from "next"
import { BudgetVarianceView } from "@/features/finance"
import { getFinancesBudgetsSubTab } from "@/features/finances/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getFinancesBudgetsSubTab("versus")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Versus Presupuestario | ERPGrafico" }

export default async function BudgetsVersusPage() {
  return <BudgetVarianceView />
}