import type { Metadata } from "next"
import { FiscalReconciliationClientView } from "@/features/tax"
import { getRcvSubTab } from "@/features/accounting/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getRcvSubTab("reconciliation")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Cuadre fiscal | ERPGrafico" }

export default async function AccountingRcvReconciliationPage() {
  return <FiscalReconciliationClientView />
}
