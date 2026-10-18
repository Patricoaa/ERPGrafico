import type { Metadata } from "next"
import { HRSettingsView } from "@/features/settings"
import { getHRConfigSubTab } from "@/features/hr/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getHRConfigSubTab("concepts")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Conceptos | ERPGrafico" }

export default async function HRSettingsConceptsPage() {
  return <HRSettingsView activeTab="concepts" />
}