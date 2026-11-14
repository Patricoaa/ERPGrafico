import type { Metadata } from "next"
import { RcvSettingsView } from "@/features/settings"
import { getAccountingConfigSubTab } from "@/features/accounting/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getAccountingConfigSubTab("rcv")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "RCV / SII | ERPGrafico" }

export default function RcvSettingsPage() {
  return <RcvSettingsView />
}
