import type { Metadata } from "next"
import { CreditPortfolioClientView } from "@/features/credits"
import { getSalesCreditsSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesCreditsSubTab("history")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Historial de Asignaciones | ERPGrafico" }

export default async function CreditsHistoryPage() {
  return <CreditPortfolioClientView activeTab="history" />
}