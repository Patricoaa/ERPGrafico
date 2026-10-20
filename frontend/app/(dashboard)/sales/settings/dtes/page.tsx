import type { Metadata } from "next"
import { DteSettingsView } from "@/features/settings"
import { getSalesDtesSubTab } from "@/features/sales/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getSalesDtesSubTab("settings")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Configuración de Documentos | ERPGrafico" }

/** ADR-0089: lado emisión — tipos DTE habilitados para Ventas/POS. */
export default async function SalesDtesSettingsPage() {
  return <DteSettingsView side="emit" />
}
