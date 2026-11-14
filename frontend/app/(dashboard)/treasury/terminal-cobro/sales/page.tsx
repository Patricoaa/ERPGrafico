import type { Metadata } from "next"
import { TerminalSalesClientView } from "@/features/treasury"
import { getTerminalCobroSubTab } from "@/features/treasury/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getTerminalCobroSubTab("sales")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Ventas del terminal de cobro | ERPGrafico" }

export default async function TerminalCobroSalesPage() {
  return <TerminalSalesClientView />
}
