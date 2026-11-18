import type { Metadata } from "next"
import { FiscalMatchClientView } from "@/features/tax"
import { getRcvSubTab } from "@/features/accounting/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getRcvSubTab("cuadre")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Cuadre | ERPGrafico" }

export default async function AccountingRcvCuadrePage() {
  return <FiscalMatchClientView />
}
