import type { Metadata } from "next"
import { RcvDocumentsClientView } from "@/features/accounting"
import { getRcvSubTab } from "@/features/accounting/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getRcvSubTab("sales")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Registro de Ventas | ERPGrafico" }

export default async function AccountingRcvSalesPage() {
  return <RcvDocumentsClientView direction="SALES" />
}
