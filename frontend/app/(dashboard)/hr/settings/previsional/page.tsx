import type { Metadata } from "next"
import { HRSettingsView } from "@/features/settings"
import { getHRConfigSubTab } from "@/features/hr/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getHRConfigSubTab("previsional")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Previsión | ERPGrafico" }

export default async function HRSettingsPrevisionalPage() {
  return <HRSettingsView activeTab="previsional" />
}