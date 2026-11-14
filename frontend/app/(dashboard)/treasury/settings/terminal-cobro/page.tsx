import type { Metadata } from "next"
import { TreasurySettingsView } from "@/features/settings"
import { getTreasuryConfigSubTab } from "@/features/treasury/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getTreasuryConfigSubTab("terminal-cobro")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Configuración del terminal de cobro | ERPGrafico" }

export default async function TreasuryTerminalSettingsPage() {
  return <TreasurySettingsView />
}
