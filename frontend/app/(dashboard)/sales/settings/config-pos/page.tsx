import type { Metadata } from "next"
import { SalesSettingsView } from "@/features/settings"
import { getSalesConfigSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesConfigSubTab("config-pos")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Configuración de POS | ERPGrafico" }

export default async function SalesSettingsConfigPosPage() {
  return <SalesSettingsView activeTab="config_pos" />
}