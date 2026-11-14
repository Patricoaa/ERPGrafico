import type { Metadata } from "next"
import { RcvImportsClientView } from "@/features/accounting"
import { getRcvSubTab } from "@/features/accounting/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getRcvSubTab("imports")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Importaciones RCV | ERPGrafico" }

export default async function AccountingRcvImportsPage() {
  return <RcvImportsClientView />
}
