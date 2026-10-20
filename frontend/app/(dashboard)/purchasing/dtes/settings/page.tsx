import type { Metadata } from "next"
import { DteSettingsView } from "@/features/settings"
import { getPurchasingDtesSubTab } from "@/features/purchasing/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getPurchasingDtesSubTab("settings")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Configuración de Documentos | ERPGrafico" }

/** ADR-0089: lado recepción — tipos DTE habilitados para Compras. */
export default async function PurchasingDtesSettingsPage() {
  return <DteSettingsView side="receive" />
}
