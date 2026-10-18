import type { Metadata } from "next"
import { BlacklistClientView } from "@/features/credits"
import { getSalesCreditsSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesCreditsSubTab("blacklist")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Lista Negra | ERPGrafico" }

export default async function CreditsBlacklistPage() {
  return <BlacklistClientView />
}