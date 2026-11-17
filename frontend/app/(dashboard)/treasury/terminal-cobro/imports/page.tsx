import type { Metadata } from "next"
import { TerminalSyncRunsClientView } from "@/features/treasury"
import { getTerminalCobroSubTab } from "@/features/treasury/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getTerminalCobroSubTab("imports")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Importaciones de ventas | ERPGrafico" }

export default async function TerminalCobroImportsPage() {
  return <TerminalSyncRunsClientView />
}
