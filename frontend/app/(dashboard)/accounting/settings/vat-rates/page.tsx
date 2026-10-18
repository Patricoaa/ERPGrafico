import type { Metadata } from "next"
import { VatRatesView } from "@/features/settings"
import { getAccountingConfigSubTab } from "@/features/accounting/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getAccountingConfigSubTab("vat-rates")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Tasas de IVA | ERPGrafico" }

export default function VatRatesPage() {
  return <VatRatesView />
}