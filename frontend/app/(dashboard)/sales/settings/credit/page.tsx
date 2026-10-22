import type { Metadata } from "next"
import { SalesSettingsView } from "@/features/settings"
import { getSalesConfigSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesConfigSubTab("credit")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Configuración de Crédito | ERPGrafico" }

export default async function SalesSettingsCreditPage() {
  return <SalesSettingsView activeTab="credit" />
}