import type { Metadata } from "next"
import { DteSettingsView } from "@/features/settings"
import { getPurchasingConfigSubTab } from "@/features/purchasing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getPurchasingConfigSubTab("dtes")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Documentos DTE | ERPGrafico" }

/** ADR-0090: la configuración DTE vive en el grupo Configuración de Compras. Lado recepción. */
export default async function PurchasingDtesSettingsPage() {
  return <DteSettingsView side="receive" />
}
