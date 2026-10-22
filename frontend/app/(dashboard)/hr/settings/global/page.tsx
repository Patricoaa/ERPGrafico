import type { Metadata } from "next"
import { HRSettingsView } from "@/features/settings"
import { getHRConfigSubTab } from "@/features/hr/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getHRConfigSubTab("global")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Globales | ERPGrafico" }

export default async function HRSettingsGlobalPage() {
  return <HRSettingsView activeTab="global" />
}