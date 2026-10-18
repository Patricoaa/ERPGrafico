import type { Metadata } from "next"
import { BillingSettingsView } from "@/features/settings"
import { getBillingConfigSubTab } from "@/features/billing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getBillingConfigSubTab("dtes")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Documentos | ERPGrafico" }

export default async function BillingSettingsDtesPage() {
  return <BillingSettingsView />
}