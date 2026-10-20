import type { Metadata } from "next"
import { BillingSettingsView } from "@/features/settings"
import { getPurchasingDtesSubTab } from "@/features/purchasing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getPurchasingDtesSubTab("settings")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Configuración de Documentos | ERPGrafico" }

export default async function PurchasingDtesSettingsPage() {
  return <BillingSettingsView />
}
