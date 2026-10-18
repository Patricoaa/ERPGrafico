import type { Metadata } from "next"
import InventorySettingsPageClient from "./InventorySettingsPageClient"
import { getInventoryConfigSubTab } from "@/features/inventory/navigation"
import { buildMetadataFromTab } from "@/lib/navigation-helpers"

const tabConfig = getInventoryConfigSubTab("valuation")
export const metadata: Metadata = tabConfig ? buildMetadataFromTab(tabConfig) : { title: "Configuración de Inventario | ERPGrafico" }

export default function InventorySettingsPage() {
  return <InventorySettingsPageClient />
}