import type { Metadata } from "next"
import { DteSettingsView } from "@/features/settings"
import { getSalesConfigSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesConfigSubTab("dtes")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Documentos DTE | ERPGrafico" }

/** ADR-0090: la configuración DTE vive en el grupo Configuración. Lado emisión. */
export default async function SalesDtesSettingsPage() {
  return <DteSettingsView side="emit" />
}
