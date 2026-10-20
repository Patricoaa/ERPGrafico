import type { Metadata } from "next"
import { BillingSettingsView } from "@/features/settings"
import { getSalesDtesSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesDtesSubTab("settings")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Configuración de Documentos | ERPGrafico" }

export default async function SalesDtesSettingsPage() {
  return <BillingSettingsView />
}
