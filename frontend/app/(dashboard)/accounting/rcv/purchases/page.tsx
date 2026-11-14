import type { Metadata } from "next"
import { RcvDocumentsClientView } from "@/features/accounting"
import { getRcvSubTab } from "@/features/accounting/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getRcvSubTab("purchases")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Registro de Compras | ERPGrafico" }

export default async function AccountingRcvPurchasesPage() {
  return <RcvDocumentsClientView direction="PURCHASES" />
}
